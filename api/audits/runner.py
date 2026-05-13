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

from .seo_audit import run_seo_audit


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


def _crawl_site(url: str, max_pages: int = 12) -> dict[str, dict[str, str]]:
    """Fetch homepage + key policy pages concurrently.

    Returns { label: {"url": ..., "title": ..., "text": ..., "html": ...,
    "labels": [...]} } with at least a "homepage" entry. Per-page text capped
    so the whole bundle stays within prompt budget. Raw (truncated) HTML is
    kept so deterministic signal extractors (payment icons, social links,
    forms) can run against the markup.

    URLs are de-duplicated: if multiple labels point at the same URL (common
    on combined "shipping & returns" pages), the URL is fetched once and the
    matching labels are recorded in `labels`. The first matching label is
    kept as the primary key for ordering.
    """
    html = _fetch_html(url, timeout=10.0)
    if html is None:
        title, text = _fetch_text(url)
        return {"homepage": {"url": url, "title": title, "text": text, "html": "", "labels": ["homepage"]}}

    homepage_title, homepage_text = _strip_html(html, max_chars=4500)
    pages: dict[str, dict[str, str]] = {
        "homepage": {
            "url": url, "title": homepage_title, "text": homepage_text,
            "html": html[:30000], "labels": ["homepage"],
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
        return labels, link, {"url": link, "title": sub_title, "text": sub_text, "html": sub[:18000]}

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(_fetch_one, lnk, lbls) for lnk, lbls in unique]
        for fut in as_completed(futures):
            labels, link, page = fut.result()
            if page:
                page["labels"] = labels
                pages[labels[0]] = page  # primary label keys the dict
                seen_urls.add(link)
    return pages


# ---- deterministic GMC compliance signals ----------------------------------
# Each signal is computed from the actual crawled HTML — no LLM involved.
# These ship as the `checks` array in the GMC report, so the customer sees
# a trustworthy yes/no checklist alongside the LLM's deeper analysis.

_PAYMENT_BRANDS = (
    "visa", "mastercard", "master-card", "amex", "american-express",
    "paypal", "discover", "stripe", "apple-pay", "apple_pay", "applepay",
    "google-pay", "google_pay", "googlepay", "klarna", "afterpay",
    "shop-pay", "shoppay", "shop_pay", "diners", "jcb", "maestro",
    "bitcoin", "crypto",
)
_SOCIAL_DOMAINS = (
    "facebook.com", "instagram.com", "tiktok.com", "twitter.com",
    "x.com", "linkedin.com", "youtube.com", "pinterest.com",
)
_FORCED_SIGNIN_PHRASES = (
    "create an account to check out",
    "create an account to checkout",
    "sign in to checkout",
    "sign in to check out",
    "log in to checkout",
    "login to checkout",
    "must have an account",
    "account required to checkout",
    "register to continue",
    "registration required",
)
_GUEST_CHECKOUT_PHRASES = (
    "guest checkout",
    "checkout as guest",
    "check out as guest",
    "continue as guest",
    "no account needed",
    "no account required",
    "without creating an account",
)
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s().\-]{8,}\d)")
_NOISE_EMAIL_PREFIXES = ("noreply@", "no-reply@", "donotreply@", "wordpress@", "example@")


def _find_phrase(text: str, phrases: tuple[str, ...]) -> str | None:
    lower = text.lower()
    for phrase in phrases:
        if phrase in lower:
            return phrase
    return None


def _gmc_signals(pages: dict[str, dict[str, str]], root_url: str) -> list[dict]:
    """Run deterministic GMC eligibility checks against the crawled pages.

    Returns a list of {item, ok, note} dicts. Every check is grounded in
    what the regex/string extractor actually saw — no fabricated numbers,
    no model-generated content.
    """
    homepage = pages.get("homepage", {})
    home_html = (homepage.get("html") or "").lower()
    home_text = homepage.get("text") or ""
    all_html = " ".join((p.get("html") or "") for p in pages.values()).lower()

    checks: list[dict] = []

    # --- HTTPS ---
    is_https = root_url.lower().startswith("https://")
    checks.append({
        "item": "Site served over HTTPS",
        "ok": is_https,
        "note": None if is_https else "Root URL is not HTTPS — Google requires HTTPS for Shopping eligibility.",
    })

    # --- Policy / informational pages reachable from homepage ---
    label_specs = [
        ("returns", "Returns / refunds page reachable from homepage"),
        ("shipping", "Shipping policy page reachable from homepage"),
        ("privacy", "Privacy policy page reachable from homepage"),
        ("terms", "Terms & conditions page reachable from homepage"),
        ("contact", "Contact page reachable from homepage"),
        ("about", "About page reachable from homepage"),
        ("faq", "FAQ / help page reachable from homepage"),
    ]
    for label, item in label_specs:
        present = label in pages
        checks.append({
            "item": item,
            "ok": present,
            "note": (
                f"Found: {pages[label]['url']}" if present
                else f"No link matching /{label}/ patterns found from the homepage."
            ),
        })

    # --- Contact email visible on homepage ---
    email_match = _EMAIL_RE.search(home_text)
    checks.append({
        "item": "Contact email visible on homepage",
        "ok": bool(email_match),
        "note": f"Found: {email_match.group(0)}" if email_match else "No email address detected in the homepage visible text.",
    })

    # --- Phone number visible on homepage ---
    phone_match = _PHONE_RE.search(home_text)
    checks.append({
        "item": "Phone number visible on homepage",
        "ok": bool(phone_match),
        "note": f"Found: {phone_match.group(0).strip()}" if phone_match else "No phone number detected in the homepage visible text.",
    })

    # --- Payment-method icons or names visible ---
    found_payments = sorted({b for b in _PAYMENT_BRANDS if b in all_html})
    checks.append({
        "item": "Accepted payment methods disclosed",
        "ok": bool(found_payments),
        "note": (
            f"Detected payment brand references: {', '.join(found_payments)}." if found_payments
            else "No payment-brand icons or names (Visa, Mastercard, PayPal, etc.) detected anywhere we crawled. Google requires upfront payment-method disclosure."
        ),
    })

    # --- Guest checkout vs forced sign-in ---
    cart_html = (pages.get("cart", {}).get("html") or "")
    checkout_html = (pages.get("checkout", {}).get("html") or "")
    cart_text = (pages.get("cart", {}).get("text") or "")
    checkout_text = (pages.get("checkout", {}).get("text") or "")
    combined = (cart_html + " " + checkout_html + " " + cart_text + " " + checkout_text)
    forced = _find_phrase(combined, _FORCED_SIGNIN_PHRASES)
    guest = _find_phrase(combined, _GUEST_CHECKOUT_PHRASES)
    cart_or_checkout_crawled = ("cart" in pages) or ("checkout" in pages)
    if guest and not forced:
        checks.append({
            "item": "Guest checkout offered (no forced sign-in)",
            "ok": True,
            "note": f"Found guest-checkout language: \"{guest}\".",
        })
    elif forced and not guest:
        checks.append({
            "item": "Guest checkout offered (no forced sign-in)",
            "ok": False,
            "note": f"Found forced sign-in language: \"{forced}\". Google prohibits collecting personal data before the buyer sees full costs.",
        })
    elif forced and guest:
        checks.append({
            "item": "Guest checkout offered (no forced sign-in)",
            "ok": False,
            "note": f"Both guest-checkout (\"{guest}\") and forced sign-in (\"{forced}\") language present — verify the actual flow.",
        })
    elif cart_or_checkout_crawled:
        checks.append({
            "item": "Guest checkout offered (no forced sign-in)",
            "ok": False,
            "note": "Cart/checkout page was crawled but no clear guest-checkout or forced-sign-in language was found — verify the flow manually.",
        })
    else:
        checks.append({
            "item": "Guest checkout offered (no forced sign-in)",
            "ok": False,
            "note": "Cart and checkout pages were not reachable from the homepage crawl — verify the flow manually.",
        })

    # --- Return window explicitly stated ---
    # Matches "30 days", "30 calendar days", "30 business days", "30-day",
    # "5 to 10 days", "5-10 días naturales", etc. Up to 2 intervening words
    # between the number(s) and "day(s)" / "día(s)".
    day_pattern = re.compile(
        r"\b(\d{1,3})(?:\s*(?:[-–]|to|a|hasta)\s*\d{1,3})?[\s\-–]+(?:(?:[a-zñáéíóú]+\s+){0,2})?(?:days?|d[ií]as?)\b",
        re.IGNORECASE,
    )
    if "returns" in pages:
        returns_text = (pages["returns"].get("text") or "")
        window_match = day_pattern.search(returns_text)
        checks.append({
            "item": "Return window explicitly stated (X days)",
            "ok": bool(window_match),
            "note": (
                f"Detected: \"{window_match.group(0).strip()}\" on the returns page." if window_match
                else "Returns page exists but no explicit X-day return window was found in the text."
            ),
        })

    # --- Shipping timeframe stated ---
    if "shipping" in pages:
        shipping_text = (pages["shipping"].get("text") or "")
        ship_match = day_pattern.search(shipping_text)
        checks.append({
            "item": "Shipping timeframe stated",
            "ok": bool(ship_match),
            "note": (
                f"Detected: \"{ship_match.group(0).strip()}\" on the shipping page." if ship_match
                else "Shipping page exists but no explicit shipping timeframe was found in the text."
            ),
        })

    # --- Contact email consistency across pages ---
    all_emails: set[str] = set()
    for page in pages.values():
        text = page.get("text") or ""
        for m in _EMAIL_RE.finditer(text):
            email = m.group(0).lower()
            if not any(email.startswith(p) for p in _NOISE_EMAIL_PREFIXES):
                all_emails.add(email)
    if not all_emails:
        checks.append({
            "item": "Single contact email used across pages",
            "ok": False,
            "note": "No contact emails detected on any crawled page.",
        })
    elif len(all_emails) == 1:
        checks.append({
            "item": "Single contact email used across pages",
            "ok": True,
            "note": f"Found: {next(iter(all_emails))}.",
        })
    else:
        checks.append({
            "item": "Single contact email used across pages",
            "ok": False,
            "note": f"Detected {len(all_emails)} distinct emails across crawled pages: {', '.join(sorted(all_emails))}. Google reads this as a fragmented business identity.",
        })

    # --- Social-media links on homepage ---
    found_social = sorted({b.replace(".com", "") for b in _SOCIAL_DOMAINS if b in home_html})
    checks.append({
        "item": "Social-media presence linked from homepage",
        "ok": bool(found_social),
        "note": (
            f"Linked: {', '.join(found_social)}." if found_social
            else "No links to common social-media domains (Facebook, Instagram, TikTok, etc.) found in homepage HTML."
        ),
    })

    return checks


# Concrete remediation steps for each signal item. Keyed by the exact `item`
# string used above so a failed check can surface real recommendations even
# when no LLM is available.
_REMEDIATIONS: dict[str, list[str]] = {
    "Site served over HTTPS": [
        "Provision an SSL certificate (most hosts include one for free — Cloudflare, Let's Encrypt, Shopify, etc.).",
        "Force-redirect every HTTP request to its HTTPS counterpart.",
    ],
    "Returns / refunds page reachable from homepage": [
        "Publish a Returns / Refunds policy page.",
        "Link to it from the homepage footer alongside Privacy and Terms.",
    ],
    "Shipping policy page reachable from homepage": [
        "Publish a Shipping policy page listing rates, regions served, and transit times.",
        "Link to it from the homepage footer.",
    ],
    "Privacy policy page reachable from homepage": [
        "Publish a Privacy policy covering what data you collect and how it is used.",
        "Link to it from the homepage footer.",
    ],
    "Terms & conditions page reachable from homepage": [
        "Publish a Terms & Conditions / Terms of Service page.",
        "Link to it from the homepage footer.",
    ],
    "Contact page reachable from homepage": [
        "Publish a Contact page with an email address, phone number, and a contact form.",
        "Link to it from the homepage footer and main nav.",
    ],
    "About page reachable from homepage": [
        "Publish an About page that names the company, founders, and location.",
        "Link to it from the homepage footer.",
    ],
    "FAQ / help page reachable from homepage": [
        "Publish a FAQ or Help Center covering shipping, returns, payment, and account questions.",
        "Link to it from the homepage footer.",
    ],
    "Contact email visible on homepage": [
        "Add a contact email to the homepage footer (mailto: link or plain text).",
    ],
    "Phone number visible on homepage": [
        "Add a phone number to the homepage footer or contact section.",
    ],
    "Accepted payment methods disclosed": [
        "Add accepted-payment icons (Visa, Mastercard, Amex, PayPal, etc.) to the homepage footer.",
        "Repeat the same icons under the Add-to-Cart button on every product page.",
    ],
    "Guest checkout offered (no forced sign-in)": [
        "Enable guest checkout so buyers can complete a purchase without creating an account.",
        "Move any account-creation step to AFTER the order summary is shown (full price + shipping + tax visible first).",
    ],
    "Return window explicitly stated (X days)": [
        "State the return window explicitly on the Returns page (e.g. \"30 days from delivery\").",
        "Use the exact same wording on the Returns page, Terms, and About pages.",
    ],
    "Shipping timeframe stated": [
        "State the shipping timeframe explicitly on the Shipping page (e.g. \"3-5 business days within Mexico\").",
        "Include separate timeframes for domestic vs international if applicable.",
    ],
    "Single contact email used across pages": [
        "Pick one canonical contact email and use it identically on the homepage footer, Contact, Privacy, and Terms pages.",
    ],
    "Social-media presence linked from homepage": [
        "Add links to your active social-media profiles (Instagram, TikTok, etc.) in the homepage footer.",
    ],
}


def _gmc_areas_from_signals(signals: list[dict]) -> list[dict]:
    """Build honest fallback `areas` from failed deterministic signals.

    Used when the LLM is unavailable or returned unparseable output. Each
    failed signal becomes an area with concrete recommendations from
    `_REMEDIATIONS`. No fabricated cross-page contradictions, no fake
    suspension language.
    """
    failed = [s for s in signals if not s.get("ok")]
    if not failed:
        return [{
            "title": "All auto-detected compliance signals passed",
            "finding": "Every deterministic check we ran against your crawled pages passed. For deeper cross-page contradiction analysis (rewritten copy, multi-page wording mismatches), set ANTHROPIC_API_KEY on the API container and re-run the audit.",
            "recommendations": [],
        }]
    areas: list[dict] = []
    for f in failed:
        item = f["item"]
        areas.append({
            "title": item,
            "finding": f.get("note") or "Check failed — see the auto-detected checklist below.",
            "recommendations": _REMEDIATIONS.get(item, []),
        })
    return areas


def _gmc_conclusion_from_signals(signals: list[dict]) -> list[str]:
    """One-line action items derived from each failed signal."""
    out: list[str] = []
    for s in signals:
        if s.get("ok"):
            continue
        recs = _REMEDIATIONS.get(s["item"], [])
        if recs:
            out.append(recs[0])
    return out or ["No deterministic compliance issues detected — consider deeper cross-page analysis with an LLM key."]


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


def _claude(prompt: str, max_tokens: int = 1500,
            api_key: str | None = None, model: str | None = None) -> str | None:
    api_key = (api_key or settings.ANTHROPIC_API_KEY or "").strip()
    if not api_key:
        return None
    model = (model or settings.ANTHROPIC_MODEL or "claude-sonnet-4-6").strip()
    try:
        r = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=45,
        )
        r.raise_for_status()
        return r.json()["content"][0]["text"]
    except Exception:  # noqa: BLE001
        return None


def _openai(prompt: str, max_tokens: int = 1500,
            api_key: str | None = None, model: str | None = None) -> str | None:
    api_key = (api_key or settings.OPENAI_API_KEY or "").strip()
    if not api_key:
        return None
    model = (model or settings.OPENAI_MODEL or "gpt-4o").strip()
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=45,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except Exception:  # noqa: BLE001
        return None


def _llm(prompt: str, max_tokens: int = 1500, *,
         provider: str = "anthropic",
         api_key: str | None = None,
         model: str | None = None) -> str | None:
    """Provider-agnostic LLM call. Picks Anthropic or OpenAI per `provider`."""
    if (provider or "anthropic").lower() == "openai":
        return _openai(prompt, max_tokens=max_tokens, api_key=api_key, model=model)
    return _claude(prompt, max_tokens=max_tokens, api_key=api_key, model=model)


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
    # GMC eligibility risks INFERRED FROM THE WEBSITE — we do not have access
    # to the merchant's GMC account, so we never fabricate suspension counts,
    # affected-item totals, or account-internal diagnostics. Every risk below
    # is something we can observe by crawling public pages.
    "areas": [
        {
            "title": "Cross-page contradictions raise misrepresentation risk",
            "finding": "Returns, About, and Terms pages describe different refund windows. Google flags inconsistent merchant information as misrepresentation — one of the most common single causes of GMC suspensions.",
            "recommendations": [
                "Pick one canonical refund window and mirror that wording in About + Terms.",
                "Cross-check the same wording against the GMC return-policy field.",
            ],
        },
        {
            "title": "Checkout transparency",
            "finding": "The checkout flow appears to require account creation before the buyer sees full costs (shipping, tax, total). Google prohibits gathering personal data before full pricing is disclosed.",
            "recommendations": [
                "Enable a guest-checkout option that reveals shipping + tax before requiring email.",
                "Move any forced sign-up below the order summary, not above it.",
            ],
        },
        {
            "title": "Pricing alignment between site and feed",
            "finding": "Shipping rates differ between the SHIPPING page and the CART page. Google flags this as 'inaccurate pricing' on a recurring basis.",
            "recommendations": [
                "Unify shipping rates across the SHIPPING page, CART, and CHECKOUT.",
                "Mirror the same rate inside the GMC shipping settings.",
            ],
        },
        {
            "title": "Business identity fragmentation",
            "finding": "Contact email in the footer differs from the email listed in PRIVACY and TERMS. Google reads multiple emails as a fragmented or impersonated business identity.",
            "recommendations": [
                "Use a single contact email across HOMEPAGE footer, CONTACT, PRIVACY, and TERMS.",
                "If a legal entity differs from the storefront brand, disclose it in a one-line footer note.",
            ],
        },
        {
            "title": "Payment-method disclosure",
            "finding": "Footer and product pages do not display accepted-payment icons. Google requires upfront disclosure of accepted payment methods before checkout begins.",
            "recommendations": [
                "Add Visa / Mastercard / Amex / PayPal icons (or your accepted set) to the footer.",
                "Repeat the icons under the Add-to-Cart button on every product page.",
            ],
        },
    ],
    # Re-uses the compliance website-audit body — same site-derived checks apply.
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
    "You are a Google Merchant Center eligibility specialist. Below is a labeled "
    "bundle of pages we crawled from the merchant's public website (HOMEPAGE "
    "plus any of: RETURNS, SHIPPING, PRIVACY, TERMS, ABOUT, CONTACT, FAQ, "
    "CHECKOUT, CART, PRODUCT). "
    "IMPORTANT CONSTRAINT — you do NOT have access to the merchant's GMC "
    "account, product feed, or any account-internal diagnostics. You see ONLY "
    "the public website. Never invent suspension messages, affected-item "
    "counts, error codes, or diagnostics-tab content. Every finding you "
    "produce must be observable from the crawled pages. "
    "Audit for GMC + Shopping eligibility risks visible on the website: "
    "misrepresentation, prohibited content, pricing alignment, checkout "
    "transparency, return + refund policy, contact info, payment disclosure. "
    "Your highest-signal findings come from CROSS-PAGE COMPARISON — Google "
    "suspends merchants for inconsistencies, not for any single page. "
    "Specifically check: "
    "(a) returns/refunds language must match across RETURNS, TERMS, ABOUT, FAQ; "
    "(b) shipping rates must match across SHIPPING, CART, CHECKOUT, PRODUCT; "
    "(c) the contact email/phone must be identical across HOMEPAGE footer, "
    "CONTACT, PRIVACY, TERMS; "
    "(d) CART/CHECKOUT must NOT force sign-in or account creation before the "
    "buyer sees full costs (look for 'create an account', 'sign in to checkout', "
    "'register' in the cart/checkout text); "
    "(e) accepted payment methods must be visibly disclosed on HOMEPAGE footer "
    "AND PRODUCT pages. "
    "Bandit ALREADY runs deterministic regex checks against the crawled "
    "HTML (HTTPS, presence of policy pages, payment-brand icons, guest "
    "checkout vs forced sign-in, return window stated, contact-email "
    "consistency, social-media presence, etc.). Do NOT duplicate those — "
    "skip them entirely. "
    "Return ONLY valid JSON with: "
    "{\"areas\": [{\"title\": str, \"finding\": str, \"recommendations\": [str]}], "
    "\"sections\": [{\"title\": str, \"finding\": str, \"recommendations\": [str]}], "
    "\"conclusion\": [str]}. "
    "Do NOT include a \"messages\" field, a \"checks\" field, or any "
    "GMC-account-internal data. "
    "Quote contradicting language directly from each page when relevant. "
    "5-7 `areas` is right; each area's `finding` should name which pages you "
    "compared (e.g. \"Returns page says X, Terms page says Y\"). "
    "`sections` should be 3-5 deeper write-ups on the highest-risk findings, "
    "with concrete rewritten copy where useful."
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

def run_audit(
    url: str,
    audit_type: str = "cro",
    *,
    provider: str = "anthropic",
    api_key: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    started = time.monotonic()
    findings: list[dict[str, Any]] = []
    report: dict[str, Any] = {}
    title = ""

    # SEO has its own deep, multi-page module — different output shape from cro.
    if audit_type == "seo":
        result = run_seo_audit(url, provider=provider, api_key=api_key, model=model)
        result["audit_type"] = "seo"
        return result

    # compliance + gmc need cross-page comparison; cro only needs the homepage.
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
        ai = _llm(prompt, provider=provider, api_key=api_key, model=model)
        parsed = _parse_json(ai, expect_array=True) if ai else None
        findings = parsed if isinstance(parsed, list) else _SEO_CANNED
    elif audit_type == "compliance":
        prompt = f"{_PROMPT_COMPLIANCE}\n\nROOT URL: {url}\n\n{bundle}"
        ai = _llm(prompt, max_tokens=4000, provider=provider, api_key=api_key, model=model)
        parsed = _parse_json(ai, expect_array=False) if ai else None
        report = parsed if isinstance(parsed, dict) else dict(_COMPLIANCE_REPORT)
        report["crawled"] = crawled
        findings = []  # compliance is long-form only
    elif audit_type == "gmc":
        # 1. Always compute the deterministic crawl-derived signals first.
        #    These are the trustworthy backbone of the report.
        signals = _gmc_signals(pages, url)

        # 2. Start from an honest skeleton derived only from those signals.
        #    No canned narrative about other sites' suspensions.
        report = {
            "checks": signals,
            "areas": _gmc_areas_from_signals(signals),
            "conclusion": _gmc_conclusion_from_signals(signals),
        }

        # 3. If the LLM is reachable and returns parseable JSON, prefer its
        #    cross-page analysis — but only the fields it actually returned.
        prompt = f"{_PROMPT_GMC}\n\nROOT URL: {url}\n\n{bundle}"
        ai = _llm(prompt, max_tokens=4500, provider=provider, api_key=api_key, model=model)
        parsed = _parse_json(ai, expect_array=False) if ai else None
        if isinstance(parsed, dict):
            if isinstance(parsed.get("areas"), list) and parsed["areas"]:
                report["areas"] = parsed["areas"]
            if isinstance(parsed.get("sections"), list) and parsed["sections"]:
                report["sections"] = parsed["sections"]
            if isinstance(parsed.get("conclusion"), list) and parsed["conclusion"]:
                report["conclusion"] = parsed["conclusion"]
            # Flag for the UI: deeper LLM analysis was applied.
            report["ai_analysis"] = True
        else:
            report["ai_analysis"] = False

        # The model never sees the GMC account; strip anything that smells of it.
        report.pop("messages", None)
        report["crawled"] = crawled
        findings = []
    else:  # cro (default)
        prompt = f"{_PROMPT_CRO}\n\nURL: {url}\nTITLE: {title}\nVISIBLE TEXT (truncated):\n{text}"
        ai = _llm(prompt, provider=provider, api_key=api_key, model=model)
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


def run_audits_bundle(
    url: str,
    audit_types: list[str],
    *,
    provider: str = "anthropic",
    api_key: str | None = None,
    model: str | None = None,
) -> dict[str, dict[str, Any]]:
    """Run several audit types against the same URL in parallel threads.

    Each call to run_audit is I/O-bound (HTTP fetch + LLM call), so threading
    gives a near-linear speedup. Returns `{audit_type: result}`. Exceptions in
    one type don't poison the others — failures show up as a `failed` status."""
    out: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=min(4, len(audit_types) or 1)) as pool:
        futures = {
            pool.submit(
                run_audit, url, t,
                provider=provider, api_key=api_key, model=model,
            ): t
            for t in audit_types
        }
        for fut in as_completed(futures):
            t = futures[fut]
            try:
                out[t] = fut.result()
            except Exception as exc:  # noqa: BLE001
                out[t] = {
                    "status": "failed",
                    "audit_type": t,
                    "error": f"audit crashed: {exc}",
                    "page_title": "",
                    "summary": "",
                    "findings": [],
                    "report": {},
                    "elapsed_ms": 0,
                }
    return out
