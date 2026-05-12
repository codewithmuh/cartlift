"""Audit runner — fetches a URL, asks Claude for type-specific findings, and
emits structured annotations + (for compliance/gmc) a long-form report body.

Falls back to deterministic canned data when ANTHROPIC_API_KEY is unset, so
the demo flow always works.

Audit types
-----------
* cro         — short findings, "predicted lift" attached. Powers the live A/B engine.
* seo         — short findings on title, meta, structured data, headings, link health.
* compliance  — long-form report: trust signals, policies, contact, payments, returns.
* gmc         — long-form Google Merchant Center / Shopping audit (suspension-safe).
"""
from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from django.conf import settings


# ---- shared fetch -----------------------------------------------------------

_UA = "BanditAudit/0.1 (+https://bandit.dev/audit)"
_HEADERS = {"User-Agent": _UA, "Accept": "text/html,application/xhtml+xml"}


def _strip_html(html: str, max_chars: int) -> tuple[str, str]:
    """Return (title, visible_text) — drops scripts/styles/comments/tags."""
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    title = (title_match.group(1).strip() if title_match else "")[:255]

    cleaned = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<style[^>]*>.*?</style>", " ", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<!--.*?-->", " ", cleaned, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", cleaned)
    text = re.sub(r"\s+", " ", text).strip()
    return title, text[:max_chars]


def _fetch_text(url: str, timeout: float = 10.0, max_chars: int = 8000) -> tuple[str, str]:
    r = requests.get(url, headers=_HEADERS, timeout=timeout, allow_redirects=True)
    r.raise_for_status()
    return _strip_html(r.text, max_chars)


def _fetch_html(url: str, timeout: float = 8.0) -> str | None:
    try:
        r = requests.get(url, headers=_HEADERS, timeout=timeout, allow_redirects=True)
        r.raise_for_status()
        return r.text
    except Exception:  # noqa: BLE001
        return None


# ---- multi-page site crawler (used by compliance + gmc) --------------------

# label → list of substrings to match against (url + anchor text), case-insensitive.
# First-match wins, scanned in declaration order so e.g. "refund-policy" classifies
# as "returns" (not "shipping" — even on combined "shipping & returns" pages).
_PAGE_PATTERNS: list[tuple[str, list[str]]] = [
    ("returns",  ["return", "refund", "exchange"]),
    ("shipping", ["shipping", "delivery", "envio"]),
    ("privacy",  ["privacy", "privacidad"]),
    ("terms",    ["terms", "tos", "conditions", "legal", "terminos"]),
    ("about",    ["about", "nosotros", "our-story"]),
    ("contact",  ["contact", "contacto", "support page"]),
    ("faq",      ["faq", "preguntas", "/help", "help center", "questions"]),
    ("checkout", ["/checkout", "pagar"]),
    ("cart",     ["/cart", "/carrito"]),
    ("product",  ["/products/", "/product/", "/p/", "/shop/", "/item/"]),
]

# Hostname must match (or be a subdomain of) the homepage host. No off-site links.
def _same_host(base: str, candidate: str) -> bool:
    bh = urlparse(base).hostname or ""
    ch = urlparse(candidate).hostname or ""
    return bool(bh) and (ch == bh or ch.endswith("." + bh) or bh.endswith("." + ch))


def _extract_links(html: str, base_url: str) -> list[tuple[str, str]]:
    """Return [(absolute_url, anchor_text), ...] — internal links only."""
    out: list[tuple[str, str]] = []
    for m in re.finditer(
        r'<a\b[^>]*?href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        href = m.group(1).strip()
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        anchor = re.sub(r"<[^>]+>", " ", m.group(2))
        anchor = re.sub(r"\s+", " ", anchor).strip().lower()
        absolute = urljoin(base_url, href)
        if not absolute.startswith(("http://", "https://")):
            continue
        if not _same_host(base_url, absolute):
            continue
        out.append((absolute, anchor))
    return out


def _classify_pages(links: list[tuple[str, str]]) -> dict[str, str]:
    """Pick at most one URL per category. First match (in DOM order) wins."""
    picks: dict[str, str] = {}
    for absolute, anchor in links:
        haystack = (absolute.lower() + " " + anchor)
        for label, needles in _PAGE_PATTERNS:
            if label in picks:
                continue
            if any(n in haystack for n in needles):
                picks[label] = absolute
                break
    return picks


def _crawl_site(url: str, max_pages: int = 8) -> dict[str, dict[str, str]]:
    """Fetch homepage + key policy pages concurrently.

    Returns { label: {"url": ..., "title": ..., "text": ..., "labels": [...]} }
    with at least a "homepage" entry. Per-page text capped so the whole bundle
    stays ~24K chars (fits with room for instructions in the prompt).

    URLs are de-duplicated: if multiple labels point at the same URL (common
    on combined "shipping & returns" pages), the URL is fetched once and the
    matching labels are recorded in `labels`. The first matching label is
    kept as the primary key for ordering.
    """
    html = _fetch_html(url, timeout=10.0)
    if html is None:
        title, text = _fetch_text(url)
        return {"homepage": {"url": url, "title": title, "text": text, "labels": ["homepage"]}}

    homepage_title, homepage_text = _strip_html(html, max_chars=4500)
    pages: dict[str, dict[str, str]] = {
        "homepage": {
            "url": url, "title": homepage_title, "text": homepage_text,
            "labels": ["homepage"],
        },
    }
    seen_urls = {url}

    picks = _classify_pages(_extract_links(html, url))
    # Group labels by URL — fetch each URL once.
    url_to_labels: dict[str, list[str]] = {}
    for label, _ in _PAGE_PATTERNS:
        if label not in picks:
            continue
        link = picks[label]
        if link in seen_urls:
            # Already covered (likely the homepage or an earlier label's URL).
            for existing_page in pages.values():
                if existing_page["url"] == link:
                    existing_page["labels"].append(label)
                    break
            continue
        url_to_labels.setdefault(link, []).append(label)

    unique = list(url_to_labels.items())[: max_pages - 1]
    if not unique:
        return pages

    def _fetch_one(link: str, labels: list[str]) -> tuple[list[str], str, dict[str, str] | None]:
        sub = _fetch_html(link, timeout=6.0)
        if sub is None:
            return labels, link, None
        sub_title, sub_text = _strip_html(sub, max_chars=2500)
        return labels, link, {"url": link, "title": sub_title, "text": sub_text}

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(_fetch_one, lnk, lbls) for lnk, lbls in unique]
        for fut in as_completed(futures):
            labels, link, page = fut.result()
            if page:
                page["labels"] = labels
                pages[labels[0]] = page  # primary label keys the dict
                seen_urls.add(link)
    return pages


def _format_bundle(pages: dict[str, dict[str, str]]) -> str:
    """Render the crawled pages as a labeled block for the prompt.

    A page covering multiple roles (e.g. combined Shipping + Returns) is
    emitted once with all matching labels in the header so Claude knows to
    apply both lenses to the same content.
    """
    parts: list[str] = []
    order = ["homepage"] + [lbl for lbl, _ in _PAGE_PATTERNS]
    emitted: set[str] = set()  # primary keys we've already rendered
    for label in order:
        if label not in pages or label in emitted:
            continue
        page = pages[label]
        emitted.add(label)
        labels = page.get("labels") or [label]
        header = ", ".join(l.upper() for l in labels)
        parts.append(
            f"=== [{header}] {page['url']}\n"
            f"TITLE: {page.get('title', '')}\n"
            f"{page.get('text', '')}"
        )
    return "\n\n".join(parts)


def _claude(prompt: str, max_tokens: int = 1500) -> str | None:
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        return None
    try:
        r = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.ANTHROPIC_MODEL,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=45,
        )
        r.raise_for_status()
        return r.json()["content"][0]["text"]
    except Exception:  # noqa: BLE001
        return None


# ---- canned fallbacks per type ---------------------------------------------

_CRO_CANNED = [
    {"surface": "hero_headline", "severity": "high", "label": "vague headline",
     "note": "Headline doesn't name the product category or buyer outcome. Visitors have to read three sentences before they understand what you sell.",
     "predicted_lift_pct": 18.3},
    {"surface": "hero_cta", "severity": "medium", "label": "low-contrast CTA",
     "note": "Primary CTA blends into the hero background. On mobile in daylight, buyers skip past it.",
     "predicted_lift_pct": 9.4},
    {"surface": "social_proof", "severity": "medium", "label": "missing trust row",
     "note": "No customer logos or testimonial in the first viewport. For B2B SaaS, this is the single most predictive missing element above the fold.",
     "predicted_lift_pct": 7.1},
    {"surface": "pricing", "severity": "low", "label": "pricing buried",
     "note": "Pricing reachable only via a footer link. Visitors who would convert self-disqualify because they can't find pricing in <10 seconds.",
     "predicted_lift_pct": 4.2},
]

_SEO_CANNED = [
    {"surface": "title", "severity": "medium", "label": "title too generic",
     "note": "Title tag is the company name only. Add the primary product term + buyer benefit (e.g. \"AI A/B testing for ecommerce\").",
     "predicted_lift_pct": 0},
    {"surface": "meta_description", "severity": "high", "label": "meta description missing",
     "note": "No <meta name=\"description\"> tag. Google generates one from page text — usually picks something off-brand.",
     "predicted_lift_pct": 0},
    {"surface": "structured_data", "severity": "medium", "label": "no Organization schema",
     "note": "Add JSON-LD Organization + Product schema. Required for rich result eligibility on brand and product queries.",
     "predicted_lift_pct": 0},
    {"surface": "headings", "severity": "low", "label": "h1 missing primary keyword",
     "note": "H1 doesn't include the primary intent keyword. Realign with the meta title for topical consistency.",
     "predicted_lift_pct": 0},
    {"surface": "speed", "severity": "medium", "label": "render-blocking resources",
     "note": "Detected 3 render-blocking JS bundles in <head>. Move below the fold or load with `defer` for ~30% LCP improvement.",
     "predicted_lift_pct": 0},
]

_COMPLIANCE_REPORT = {
    # 22-item website-trust checklist matching Yoon Lab / KeyCommerce format.
    "checks": [
        {"item": "Physical address", "ok": True},
        {"item": "Business details", "ok": True},
        {"item": "Customer service telephone number", "ok": True},
        {"item": "Contact email address", "ok": False, "note": "Email differs across pages."},
        {"item": "Contact form or contact page", "ok": False, "note": "No on-page form."},
        {"item": "Business hours and response time", "ok": True},
        {"item": "Shipping page", "ok": False, "note": "Shipping rates differ between site and checkout."},
        {"item": "Secure checkout page", "ok": True},
        {"item": "Returns and refunds page", "ok": False, "note": "Three pages contradict each other."},
        {"item": "Terms & conditions page", "ok": True},
        {"item": "Privacy policy page", "ok": True},
        {"item": "Payment methods", "ok": False, "note": "No payment icons in footer or PDP."},
        {"item": "Product availability", "ok": True},
        {"item": "Product pricing", "ok": True},
        {"item": "Product content", "ok": True},
        {"item": "Product reviews", "ok": True},
        {"item": "Product pages", "ok": True},
        {"item": "Website homepage structure", "ok": True},
        {"item": "Website's performance", "ok": True},
        {"item": "About us page", "ok": True},
        {"item": "Checkout page", "ok": False, "note": "Forced sign-in before order summary."},
        {"item": "Footer", "ok": False, "note": "Footer lacks payment + policy links."},
    ],
    "sections": [
        {
            "title": "Checkout sign-in requirement",
            "finding": "The site forces users to register before checkout. Google strictly prohibits gathering personal data behind a wall before the buyer sees full costs. This is the most common single cause of GMC suspensions for new merchants.",
            "recommendations": [
                "Enable a guest checkout option so users can complete a purchase without creating an account.",
                "Ensure the cart → payment transition is unobstructed by mandatory pop-ups or account-creation gates.",
            ],
        },
        {
            "title": "Shipping policy mismatch",
            "finding": "The site advertises a $170 MXN flat shipping rate; GMC settings have $99 MXN. Google flags pricing mismatches as 'misleading information' and triggers automatic suspensions.",
            "recommendations": [
                "Update GMC shipping settings to mirror the on-site rate exactly.",
                "Verify the rate is honored at the final payment screen with no hidden fees.",
            ],
        },
        {
            "title": "Returns + refunds — contradictions across pages",
            "finding": "About Us, Returns, and T&Cs pages describe three different return policies. Reviewers (and the policy bot) read this as customer-trap behavior.",
            "recommendations": [
                "Rewrite About Us + T&Cs to mirror the canonical Returns page.",
                "Cross-reference GMC return settings with the same canonical text.",
            ],
        },
        {
            "title": "Inconsistent contact email",
            "finding": "Contact + footer use one email; Privacy + Terms use a different email on a different domain. Google reads this as a fragmented business identity.",
            "recommendations": [
                "Replace all secondary email addresses with the primary contact email.",
                "Add a one-line clarifier if your storefront name differs from your legal entity.",
            ],
        },
        {
            "title": "Missing payment-method icons",
            "finding": "Footer and PDP lack visible accepted-payment icons. Google requires upfront disclosure of payment options before checkout begins.",
            "recommendations": [
                "Add Visa / Mastercard / Amex / PayPal icons to the footer.",
                "Repeat the icons immediately under the Add-to-Cart button on PDPs.",
            ],
        },
        {
            "title": "Contact page lacks a form",
            "finding": "The Contact page lists email + phone but no working contact form. A direct on-page form is a baseline trust signal Google looks for.",
            "recommendations": [
                "Add a simple form with name, email, order number, message.",
                "Display the stated response time directly above the form.",
            ],
        },
    ],
    "conclusion": [
        "Remove checkout barriers — disable forced account creation.",
        "Unify pricing data — sync site shipping with GMC shipping.",
        "Synchronize return language — one canonical policy across all pages.",
        "Consolidate business identity — single primary email everywhere.",
        "Enhance visual trust signals — payment icons in footer + PDPs.",
        "Improve accessibility — add an on-site contact form.",
    ],
}

_GMC_REPORT = {
    "messages": [
        {"type": "Error", "description": "Suspended account for policy violation",
         "affected": 441},
    ],
    "areas": [
        {
            "title": "Policy violation — Misrepresentation",
            "finding": "Account suspended for Misrepresentation. Typically caused by website trust + legitimacy issues. See website audit below.",
            "recommendations": [],
        },
        {
            "title": "Product feed",
            "finding": "No issues or warnings in the GMC Diagnostics 'Needs attention' tab.",
            "recommendations": ["No recommendations."],
        },
        {
            "title": "Business information",
            "finding": "No business information issues identified within GMC.",
            "recommendations": ["No recommendations."],
        },
        {
            "title": "Shipping settings",
            "finding": "No shipping policy issues identified within GMC.",
            "recommendations": ["No recommendations."],
        },
        {
            "title": "Branding",
            "finding": "No branding issues identified within GMC.",
            "recommendations": ["No recommendations."],
        },
        {
            "title": "Return policy",
            "finding": "No return policy issues identified within GMC.",
            "recommendations": ["No recommendations."],
        },
    ],
    # Re-uses the compliance website-audit body — same checks apply.
    **_COMPLIANCE_REPORT,
}


# ---- per-type prompt templates ---------------------------------------------

_PROMPT_CRO = (
    "You are a senior conversion-rate-optimization (CRO) consultant. "
    "Audit the page below and return 3-5 specific, actionable findings. "
    "Output ONLY valid JSON — an array of objects with these keys: "
    "surface (one of: hero_headline, hero_cta, social_proof, pricing, checkout, nav, footer, custom), "
    "severity (high|medium|low), label (3-6 words), note (1-3 sentences, specific to this page), "
    "predicted_lift_pct (number, 1-25 realistic estimate)."
)
_PROMPT_SEO = (
    "You are a senior SEO consultant. Audit the page below and return 4-6 specific findings. "
    "Output ONLY valid JSON — an array of objects with: "
    "surface (title|meta_description|structured_data|headings|images|speed|crawl|links), "
    "severity (high|medium|low), label (3-6 words), note (1-3 sentences, specific to this page), "
    "predicted_lift_pct (always 0)."
)
_PROMPT_COMPLIANCE = (
    "You are a senior ecommerce compliance auditor. Below is a labeled bundle of "
    "pages we crawled from the merchant's site (HOMEPAGE plus any of: RETURNS, "
    "SHIPPING, PRIVACY, TERMS, ABOUT, CONTACT, FAQ, CHECKOUT, CART, PRODUCT). "
    "Compare across pages — your most valuable findings are CROSS-PAGE "
    "CONTRADICTIONS (e.g. one return rule on RETURNS, a different one on TERMS; "
    "one email in the footer, another inside PRIVACY; one shipping rate on "
    "SHIPPING, a different one on PRODUCT). "
    "Also check the CART/CHECKOUT pages for forced sign-in / required-account "
    "creation language — Google strictly prohibits gathering personal data "
    "before the buyer sees full costs. "
    "Return ONLY valid JSON with: "
    "{\"checks\": [{\"item\": str, \"ok\": bool, \"note\"?: str}], "
    "\"sections\": [{\"title\": str, \"finding\": str, \"recommendations\": [str]}], "
    "\"conclusion\": [str]}. "
    "5-7 sections covering the most impactful policy + trust issues. "
    "Quote the contradicting language directly from each page when relevant."
)
_PROMPT_GMC = (
    "You are a Google Merchant Center suspension specialist. Below is a labeled "
    "bundle of pages we crawled from the merchant's site (HOMEPAGE plus any of: "
    "RETURNS, SHIPPING, PRIVACY, TERMS, ABOUT, CONTACT, FAQ, CHECKOUT, CART, "
    "PRODUCT). Audit for GMC + Shopping eligibility: misrepresentation, "
    "prohibited content, pricing alignment, checkout transparency, return + "
    "refund policy, contact info, payment disclosure. "
    "Read EVERY labeled section. Your highest-signal findings come from "
    "CROSS-PAGE COMPARISON — Google suspends merchants for inconsistencies, not "
    "for any single page. Specifically check: "
    "(a) returns/refunds language must match across RETURNS, TERMS, ABOUT, FAQ; "
    "(b) shipping rates must match across SHIPPING, CART, CHECKOUT, PRODUCT; "
    "(c) the contact email/phone must be identical across HOMEPAGE footer, "
    "CONTACT, PRIVACY, TERMS; "
    "(d) CART/CHECKOUT must NOT force sign-in or account creation before the "
    "buyer sees full costs (look for 'create an account', 'sign in to checkout', "
    "'register' in the cart/checkout text); "
    "(e) accepted payment methods must be visibly disclosed on HOMEPAGE footer "
    "AND PRODUCT pages. "
    "Return ONLY valid JSON with: "
    "{\"messages\": [{\"type\": \"Error|Warning|Notification\", \"description\": str, \"affected\": int}], "
    "\"areas\": [{\"title\": str, \"finding\": str, \"recommendations\": [str]}], "
    "\"checks\": [{\"item\": str, \"ok\": bool, \"note\"?: str}], "
    "\"sections\": [{\"title\": str, \"finding\": str, \"recommendations\": [str]}], "
    "\"conclusion\": [str]}. "
    "Quote the contradicting language directly from each page when relevant. "
    "5-7 sections is right; each section's `finding` should name which pages "
    "you compared (e.g. \"Returns page says X, Terms page says Y\")."
)


def _parse_json(text: str, expect_array: bool) -> Any | None:
    if not text:
        return None
    pattern = r"\[\s*\{.*?\}\s*\]" if expect_array else r"\{.*\}"
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


# ---- main entry -------------------------------------------------------------

def run_audit(url: str, audit_type: str = "cro") -> dict[str, Any]:
    started = time.monotonic()
    findings: list[dict[str, Any]] = []
    report: dict[str, Any] = {}
    title = ""

    # compliance + gmc need cross-page comparison; cro + seo only need the homepage.
    multi_page = audit_type in {"compliance", "gmc"}

    if multi_page:
        try:
            pages = _crawl_site(url)
        except Exception as exc:  # noqa: BLE001
            return {
                "status": "failed",
                "error": f"could not fetch URL: {exc}",
                "elapsed_ms": int((time.monotonic() - started) * 1000),
                "audit_type": audit_type,
            }
        title = pages.get("homepage", {}).get("title", "")
        bundle = _format_bundle(pages)
        crawled = [
            {
                "label": label,
                "labels": page.get("labels") or [label],
                "url": page["url"],
                "title": page.get("title", ""),
            }
            for label, page in pages.items()
        ]
    else:
        try:
            title, text = _fetch_text(url)
        except Exception as exc:  # noqa: BLE001
            return {
                "status": "failed",
                "error": f"could not fetch URL: {exc}",
                "elapsed_ms": int((time.monotonic() - started) * 1000),
                "audit_type": audit_type,
            }

    if audit_type == "seo":
        prompt = f"{_PROMPT_SEO}\n\nURL: {url}\nTITLE: {title}\nVISIBLE TEXT (truncated):\n{text}"
        ai = _claude(prompt)
        parsed = _parse_json(ai, expect_array=True) if ai else None
        findings = parsed if isinstance(parsed, list) else _SEO_CANNED
    elif audit_type == "compliance":
        prompt = f"{_PROMPT_COMPLIANCE}\n\nROOT URL: {url}\n\n{bundle}"
        ai = _claude(prompt, max_tokens=4000)
        parsed = _parse_json(ai, expect_array=False) if ai else None
        report = parsed if isinstance(parsed, dict) else dict(_COMPLIANCE_REPORT)
        report["crawled"] = crawled
        findings = []  # compliance is long-form only
    elif audit_type == "gmc":
        prompt = f"{_PROMPT_GMC}\n\nROOT URL: {url}\n\n{bundle}"
        ai = _claude(prompt, max_tokens=4500)
        parsed = _parse_json(ai, expect_array=False) if ai else None
        report = parsed if isinstance(parsed, dict) else dict(_GMC_REPORT)
        report["crawled"] = crawled
        findings = []
    else:  # cro (default)
        prompt = f"{_PROMPT_CRO}\n\nURL: {url}\nTITLE: {title}\nVISIBLE TEXT (truncated):\n{text}"
        ai = _claude(prompt)
        parsed = _parse_json(ai, expect_array=True) if ai else None
        findings = parsed if isinstance(parsed, list) else _CRO_CANNED

    if findings:
        summary = (
            f"Found {len(findings)} {audit_type.upper()} opportunities on {url}. "
            f"Most impactful: " + ", ".join(f.get("label", "?") for f in findings[:3]) + "."
        )
    elif report:
        section_count = len(report.get("sections") or [])
        check_count = len(report.get("checks") or [])
        summary = (
            f"{audit_type.upper()} audit complete for {url}. "
            f"{section_count} review sections, {check_count} compliance checks."
        )
    else:
        summary = f"{audit_type.upper()} audit completed for {url}."

    return {
        "status": "done",
        "audit_type": audit_type,
        "page_title": title,
        "summary": summary,
        "findings": findings,
        "report": report,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
    }
