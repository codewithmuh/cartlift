"""Deep, multi-page SEO audit.

Crawls the homepage + sitemap.xml entries + internal links (up to N pages),
extracts structured per-page SEO data, derives site-wide diagnostics, scores
each axis (technical / content / structured-data / performance), then asks
Claude for prioritized opportunities and recommendations.

Output report shape (stored on Audit.report):

    {
      "crawled":       [{url, status, title, meta_description, h1, h1_count,
                         word_count, schema_types, og, twitter, canonical,
                         lang, viewport, indexable, response_ms, byte_size,
                         img_total, img_with_alt, internal_links, external_links}, ...],
      "site": {
        "https": bool, "robots_txt": {present, lines}, "sitemap_xml":
        {present, url_count, sample}, "duplicate_titles": [{title, urls}],
        "duplicate_metas": [{meta, urls}], "pages_missing_meta": [urls],
        "pages_missing_h1": [urls], "pages_missing_canonical": [urls],
        "pages_thin": [urls], "lang_inconsistencies": [...],
      },
      "scores":       {technical, content, structured_data, performance,
                       overall},
      "checks":       [{item, ok, note?}, ...],        # 18-25 deterministic
      "opportunities":[{title, severity, surface, effort, impact, note}, ...],
      "sections":     [{title, finding, recommendations}, ...],
      "conclusion":   [str, ...],
    }
"""
from __future__ import annotations

import html as html_lib
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import requests
from django.conf import settings

_UA = "BanditAudit/0.1 (+https://bandit.dev/audit)"
_HEADERS = {"User-Agent": _UA, "Accept": "text/html,application/xhtml+xml"}

_MAX_PAGES = 12
_PER_PAGE_TIMEOUT = 6.0
_HOMEPAGE_TIMEOUT = 10.0
_THIN_WORD_THRESHOLD = 250

# Google SERP pixel ceilings (approximations — real widths depend on glyph,
# but these are what every major SEO tool uses as the de-facto thresholds).
_TITLE_PIXEL_MAX = 580
_META_PIXEL_MAX = 990

# Top ~80 English stop words for keyword density + content quality checks.
_STOP_WORDS = frozenset((
    "a an and are as at be been but by for from has have he her hers him his how i if in is it "
    "its me my no nor not of on or our ours she so some such than that the their them then there "
    "these they this those to too us was we were what when where which who whom why will with you "
    "your yours about across after again all also am any been before being between can could did do "
    "does doing down during each few further had having into just more most off once only other "
    "out over own same should some until up very while would here through above below"
).split())


# ---- low-level helpers -------------------------------------------------------

def _same_host(base: str, candidate: str) -> bool:
    bh = urlparse(base).hostname or ""
    ch = urlparse(candidate).hostname or ""
    return bool(bh) and (ch == bh or ch.endswith("." + bh) or bh.endswith("." + ch))


def _meta_content(html: str, name: str, attr: str = "name") -> str:
    """Return the `content="…"` of <meta {attr}="{name}">. First match wins."""
    pattern = rf'<meta\s+[^>]*?{attr}\s*=\s*["\']{re.escape(name)}["\'][^>]*?content\s*=\s*["\']([^"\']*)["\']'
    m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1).strip()
    # Try with attributes in reverse order
    pattern2 = rf'<meta\s+[^>]*?content\s*=\s*["\']([^"\']*)["\'][^>]*?{attr}\s*=\s*["\']{re.escape(name)}["\']'
    m = re.search(pattern2, html, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else ""


def _link_href(html: str, rel: str) -> str:
    pattern = rf'<link\s+[^>]*?rel\s*=\s*["\']{re.escape(rel)}["\'][^>]*?href\s*=\s*["\']([^"\']+)["\']'
    m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1).strip()
    pattern2 = rf'<link\s+[^>]*?href\s*=\s*["\']([^"\']+)["\'][^>]*?rel\s*=\s*["\']{re.escape(rel)}["\']'
    m = re.search(pattern2, html, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else ""


def _html_lang(html: str) -> str:
    m = re.search(r'<html\b[^>]*?lang\s*=\s*["\']([^"\']+)["\']', html, re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _viewport(html: str) -> str:
    return _meta_content(html, "viewport")


def _meta_robots(html: str) -> str:
    return _meta_content(html, "robots")


def _title(html: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if not m:
        return ""
    raw = re.sub(r"\s+", " ", m.group(1)).strip()
    return html_lib.unescape(raw)[:255]


def _h1_info(html: str) -> tuple[int, str]:
    matches = re.findall(r"<h1\b[^>]*>(.*?)</h1>", html, re.IGNORECASE | re.DOTALL)
    if not matches:
        return 0, ""
    text = re.sub(r"<[^>]+>", " ", matches[0])
    text = re.sub(r"\s+", " ", text).strip()
    return len(matches), text[:200]


def _visible_text(html: str) -> str:
    cleaned = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<style[^>]*>.*?</style>", " ", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<!--.*?-->", " ", cleaned, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", cleaned)
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _word_count(text: str) -> int:
    return len(text.split()) if text else 0


def _schema_types(html: str) -> list[str]:
    """Pull @type values out of every <script type="application/ld+json"> block."""
    out: list[str] = []
    for block in re.findall(
        r'<script\b[^>]*?type\s*=\s*["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, flags=re.IGNORECASE | re.DOTALL,
    ):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            # Some sites embed multiple JSONs concatenated — try lenient extract.
            for m in re.finditer(r'"@type"\s*:\s*"([^"]+)"', block):
                out.append(m.group(1))
            continue
        for t in _walk_types(data):
            out.append(t)
    # Dedupe preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for t in out:
        if t not in seen:
            seen.add(t)
            deduped.append(t)
    return deduped


def _walk_types(node: object) -> list[str]:
    found: list[str] = []
    if isinstance(node, dict):
        t = node.get("@type")
        if isinstance(t, str):
            found.append(t)
        elif isinstance(t, list):
            found.extend([x for x in t if isinstance(x, str)])
        for v in node.values():
            found.extend(_walk_types(v))
    elif isinstance(node, list):
        for item in node:
            found.extend(_walk_types(item))
    return found


def _image_stats(html: str) -> tuple[int, int]:
    """Return (total_img_tags, count_with_non_empty_alt)."""
    total = 0
    with_alt = 0
    for tag in re.findall(r"<img\b[^>]*>", html, flags=re.IGNORECASE):
        total += 1
        m = re.search(r'\balt\s*=\s*["\']([^"\']*)["\']', tag, re.IGNORECASE)
        if m and m.group(1).strip():
            with_alt += 1
    return total, with_alt


def _count_links(html: str, base_url: str) -> tuple[int, int]:
    """Return (internal, external) link counts."""
    internal = external = 0
    for m in re.finditer(r'<a\b[^>]*?href\s*=\s*["\']([^"\']+)["\']', html, re.IGNORECASE | re.DOTALL):
        href = m.group(1).strip()
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href)
        if not absolute.startswith(("http://", "https://")):
            continue
        if _same_host(base_url, absolute):
            internal += 1
        else:
            external += 1
    return internal, external


def _internal_links(html: str, base_url: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for m in re.finditer(r'<a\b[^>]*?href\s*=\s*["\']([^"\']+)["\']', html, re.IGNORECASE | re.DOTALL):
        href = m.group(1).strip()
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href.split("#", 1)[0])
        if not absolute.startswith(("http://", "https://")):
            continue
        if not _same_host(base_url, absolute):
            continue
        # Strip trailing slash for dedupe
        norm = absolute.rstrip("/")
        if norm in seen:
            continue
        seen.add(norm)
        out.append(absolute)
    return out


# ---- expanded extraction helpers --------------------------------------------

def _pixel_width(text: str, font_px: int = 14) -> int:
    """Rough Google-SERP-style pixel-width estimate for `text` at font size
    `font_px`. Wider glyphs (W, M, m, w) carry more weight than narrow ones (i,
    l, t). This is what Seobility / Yoast / Rank Math all do — it's an
    approximation, not a screenshot."""
    if not text:
        return 0
    total = 0.0
    for ch in text:
        if ch in "ilI|.,;:":
            total += 0.30
        elif ch in "fjrt ":
            total += 0.40
        elif ch in "WM":
            total += 1.05
        elif ch in "mw":
            total += 0.95
        elif ch in "abcdeghknopqsuvxyz0123456789":
            total += 0.62
        elif ch.isupper():
            total += 0.78
        else:
            total += 0.60
    return int(total * font_px)


def _heading_texts(html: str, level: int) -> list[str]:
    out: list[str] = []
    for raw in re.findall(rf"<h{level}\b[^>]*>(.*?)</h{level}>", html, re.IGNORECASE | re.DOTALL):
        text = re.sub(r"<[^>]+>", " ", raw)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            out.append(text[:160])
    return out


def _paragraph_count(html: str) -> int:
    return len(re.findall(r"<p\b[^>]*>", html, re.IGNORECASE))


def _strong_bold_count(html: str) -> int:
    return len(re.findall(r"<(?:strong|b)\b", html, re.IGNORECASE))


def _content_stats(text: str) -> dict:
    """Sentence + stop-word stats from cleaned visible text."""
    if not text:
        return {"sentence_count": 0, "avg_sentence_length": 0, "stop_word_pct": 0}
    sentences = re.split(r"[.!?]+\s+", text)
    sentences = [s for s in sentences if s.strip()]
    words = re.findall(r"\b[a-zA-Z]+\b", text.lower())
    total = len(words)
    stop = sum(1 for w in words if w in _STOP_WORDS)
    return {
        "sentence_count": len(sentences),
        "avg_sentence_length": round(total / max(len(sentences), 1), 1),
        "stop_word_pct": round(100 * stop / total) if total else 0,
    }


def _common_keywords(text: str, top: int = 10) -> list[dict]:
    """Top single-word terms in the cleaned text (lowercased, stop-words filtered,
    ≥3 chars, alpha only). Used to render the keyword-density panel."""
    if not text:
        return []
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    if not words:
        return []
    freq: dict[str, int] = {}
    for w in words:
        if w in _STOP_WORDS:
            continue
        freq[w] = freq.get(w, 0) + 1
    total = sum(freq.values()) or 1
    sorted_kw = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:top]
    return [
        {"term": w, "count": c, "density_pct": round(100 * c / total, 1)}
        for w, c in sorted_kw
    ]


def _doctype(html: str) -> str:
    """Returns the doctype string if declared at the very top of the document."""
    head = html[:200].strip()
    m = re.match(r"<!DOCTYPE\s+([^>]+)>", head, re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _charset(html: str) -> str:
    m = re.search(r'<meta\s+[^>]*?charset\s*=\s*["\']?([^"\'\s>]+)', html[:2000], re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _favicon(html: str) -> str:
    for rel in ("icon", "shortcut icon"):
        href = _link_href(html, rel)
        if href:
            return href
    return ""


def _apple_touch_icon(html: str) -> str:
    return _link_href(html, "apple-touch-icon") or _link_href(html, "apple-touch-icon-precomposed")


def _hreflangs(html: str) -> list[dict]:
    out: list[dict] = []
    for m in re.finditer(
        r'<link\s+[^>]*?rel\s*=\s*["\']alternate["\'][^>]*?hreflang\s*=\s*["\']([^"\']+)["\'][^>]*?href\s*=\s*["\']([^"\']+)["\']',
        html, re.IGNORECASE | re.DOTALL,
    ):
        out.append({"lang": m.group(1).strip(), "href": m.group(2).strip()})
    if not out:
        for m in re.finditer(
            r'<link\s+[^>]*?rel\s*=\s*["\']alternate["\'][^>]*?href\s*=\s*["\']([^"\']+)["\'][^>]*?hreflang\s*=\s*["\']([^"\']+)["\']',
            html, re.IGNORECASE | re.DOTALL,
        ):
            out.append({"lang": m.group(2).strip(), "href": m.group(1).strip()})
    return out[:20]


def _resource_counts(html: str) -> dict:
    js = len(re.findall(r'<script\b[^>]*\bsrc\s*=\s*["\'][^"\']+', html, re.IGNORECASE))
    css = len(re.findall(r'<link\b[^>]*\brel\s*=\s*["\']stylesheet["\']', html, re.IGNORECASE))
    inline_js = len(re.findall(r'<script\b(?![^>]*\bsrc\s*=)[^>]*>', html, re.IGNORECASE))
    return {"js_files": js, "css_files": css, "inline_scripts": inline_js}


def _url_quality(final_url: str) -> dict:
    """Detect SEO-hostile URL patterns."""
    parsed = urlparse(final_url)
    qs = parsed.query
    has_session = bool(re.search(r"(?i)\b(s|sid|sess|session(?:id)?|phpsessid)=", qs))
    param_count = len([p for p in qs.split("&") if p])
    depth = len([s for s in parsed.path.split("/") if s])
    return {
        "param_count": param_count,
        "has_session_id": has_session,
        "depth": depth,
    }


# ---- per-page fetch + parse --------------------------------------------------

def _fetch_page(url: str, timeout: float) -> dict | None:
    """GET a URL and return a parsed snapshot, or None on failure."""
    started = time.monotonic()
    try:
        r = requests.get(url, headers=_HEADERS, timeout=timeout, allow_redirects=True)
    except requests.RequestException as exc:
        return {
            "url": url, "status": 0, "error": str(exc)[:120],
            "response_ms": int((time.monotonic() - started) * 1000),
        }
    elapsed_ms = int((time.monotonic() - started) * 1000)
    final_url = r.url

    if not r.ok:
        return {
            "url": final_url, "status": r.status_code,
            "response_ms": elapsed_ms, "byte_size": len(r.content or b""),
            "error": f"HTTP {r.status_code}",
        }

    html = r.text or ""
    title = _title(html)
    meta_desc = _meta_content(html, "description")
    canonical_raw = _link_href(html, "canonical")
    canonical = urljoin(final_url, canonical_raw) if canonical_raw else ""
    robots = _meta_robots(html)
    lang = _html_lang(html)
    viewport = _viewport(html)
    h1_count, h1_text = _h1_info(html)
    h2_texts = _heading_texts(html, 2)
    h3_texts = _heading_texts(html, 3)
    text = _visible_text(html)
    img_total, img_with_alt = _image_stats(html)
    internal_links, external_links = _count_links(html, final_url)
    schemas = _schema_types(html)
    stats = _content_stats(text)
    keywords = _common_keywords(text)
    resources = _resource_counts(html)
    url_quality = _url_quality(final_url)

    og = {
        "title": _meta_content(html, "og:title", attr="property"),
        "description": _meta_content(html, "og:description", attr="property"),
        "image": _meta_content(html, "og:image", attr="property"),
        "url": _meta_content(html, "og:url", attr="property"),
        "type": _meta_content(html, "og:type", attr="property"),
    }
    twitter = {
        "card": _meta_content(html, "twitter:card"),
        "title": _meta_content(html, "twitter:title"),
        "description": _meta_content(html, "twitter:description"),
        "image": _meta_content(html, "twitter:image"),
    }

    indexable = "noindex" not in (robots or "").lower() and r.status_code == 200

    return {
        "url": final_url,
        "status": r.status_code,
        "response_ms": elapsed_ms,
        "byte_size": len(r.content or b""),
        "redirected": final_url.rstrip("/") != url.rstrip("/"),
        "title": title,
        "title_length": len(title),
        "title_pixel_width": _pixel_width(title),
        "meta_description": meta_desc,
        "meta_description_length": len(meta_desc),
        "meta_description_pixel_width": _pixel_width(meta_desc),
        "canonical": canonical,
        "canonical_is_self": bool(canonical) and canonical.rstrip("/") == final_url.rstrip("/"),
        "robots": robots,
        "indexable": indexable,
        "lang": lang,
        "viewport": viewport,
        "doctype": _doctype(html),
        "charset": _charset(html),
        "favicon": _favicon(html),
        "apple_touch_icon": _apple_touch_icon(html),
        "h1_count": h1_count,
        "h1": h1_text,
        "h2_count": len(h2_texts),
        "h2": h2_texts[:8],
        "h3_count": len(h3_texts),
        "word_count": _word_count(text),
        "sentence_count": stats["sentence_count"],
        "avg_sentence_length": stats["avg_sentence_length"],
        "stop_word_pct": stats["stop_word_pct"],
        "paragraph_count": _paragraph_count(html),
        "strong_bold_count": _strong_bold_count(html),
        "img_total": img_total,
        "img_with_alt": img_with_alt,
        "img_alt_pct": round(100 * img_with_alt / img_total) if img_total else 100,
        "internal_links": internal_links,
        "external_links": external_links,
        "schema_types": schemas,
        "og": og,
        "twitter": twitter,
        "hreflangs": _hreflangs(html),
        "js_files": resources["js_files"],
        "css_files": resources["css_files"],
        "inline_scripts": resources["inline_scripts"],
        "compression": (r.headers.get("Content-Encoding") or "").lower(),
        "server": r.headers.get("Server", "")[:60],
        "x_powered_by": r.headers.get("X-Powered-By", "")[:60],
        "last_modified": r.headers.get("Last-Modified", ""),
        "url_param_count": url_quality["param_count"],
        "url_has_session_id": url_quality["has_session_id"],
        "url_depth": url_quality["depth"],
        "keywords": keywords,
        "_html": html,  # kept for site-wide passes; stripped before persist
        "_text": text[:1200],
    }


# ---- crawl orchestration -----------------------------------------------------

def _fetch_robots_txt(origin: str) -> dict:
    url = urljoin(origin, "/robots.txt")
    try:
        r = requests.get(url, headers=_HEADERS, timeout=5)
    except requests.RequestException:
        return {"present": False, "url": url}
    if r.status_code != 200 or not (r.text or "").strip():
        return {"present": False, "url": url, "status": r.status_code}
    body = r.text or ""
    sitemaps = re.findall(r"(?im)^\s*Sitemap:\s*(\S+)", body)
    disallows = re.findall(r"(?im)^\s*Disallow:\s*(\S+)", body)
    return {
        "present": True, "url": url, "status": r.status_code,
        "sitemaps": list(dict.fromkeys(sitemaps))[:10],
        "disallow_count": len(disallows),
        "byte_size": len(body),
    }


def _fetch_sitemap(origin: str, robots: dict) -> dict:
    candidates: list[str] = []
    if robots.get("sitemaps"):
        candidates.extend(robots["sitemaps"])
    candidates.append(urljoin(origin, "/sitemap.xml"))
    candidates.append(urljoin(origin, "/sitemap_index.xml"))

    seen: set[str] = set()
    for sm_url in candidates:
        if sm_url in seen:
            continue
        seen.add(sm_url)
        try:
            r = requests.get(sm_url, headers=_HEADERS, timeout=6)
        except requests.RequestException:
            continue
        if r.status_code != 200 or not (r.text or "").strip():
            continue
        urls = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", r.text or "")
        return {
            "present": True, "url": sm_url, "status": r.status_code,
            "url_count": len(urls), "sample": urls[:12],
        }
    return {"present": False, "url": candidates[0] if candidates else ""}


def _crawl(base_url: str, max_pages: int = _MAX_PAGES) -> dict:
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    robots = _fetch_robots_txt(origin)
    home = _fetch_page(base_url, timeout=_HOMEPAGE_TIMEOUT)
    pages: list[dict] = []
    if home:
        pages.append(home)

    sitemap = _fetch_sitemap(origin, robots)

    # Build crawl queue: sitemap-sampled URLs (preferred) → homepage internal links.
    queue: list[str] = []
    seen_urls = {p["url"].rstrip("/") for p in pages}

    if sitemap.get("present") and sitemap.get("sample"):
        for u in sitemap["sample"]:
            if not _same_host(base_url, u):
                continue
            norm = u.rstrip("/")
            if norm in seen_urls:
                continue
            queue.append(u)
            seen_urls.add(norm)

    if home and "_html" in home:
        for u in _internal_links(home["_html"], home["url"]):
            norm = u.rstrip("/")
            if norm in seen_urls:
                continue
            queue.append(u)
            seen_urls.add(norm)

    queue = queue[: max_pages - len(pages)]

    if queue:
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(_fetch_page, u, _PER_PAGE_TIMEOUT) for u in queue]
            for fut in as_completed(futures):
                p = fut.result()
                if p:
                    pages.append(p)

    return {"pages": pages, "robots": robots, "sitemap": sitemap, "origin": origin}


# ---- diagnostics + scoring ---------------------------------------------------

def _www_canonicalization(origin: str) -> dict:
    """Check whether the www and non-www variants both resolve to the same final URL.
    A split (one indexes both versions) is a duplicate-content footgun."""
    parsed = urlparse(origin)
    host = parsed.netloc
    if not host:
        return {"checked": False}
    if host.startswith("www."):
        bare, wwwed = host[4:], host
    else:
        bare, wwwed = host, "www." + host
    results: dict[str, str] = {}
    for variant in (f"{parsed.scheme}://{bare}", f"{parsed.scheme}://{wwwed}"):
        try:
            r = requests.head(variant, headers=_HEADERS, timeout=5, allow_redirects=True)
            results[variant] = r.url
        except requests.RequestException:
            results[variant] = ""
    finals = {v.rstrip("/") for v in results.values() if v}
    return {
        "checked": True,
        "variants": results,
        "unified": len(finals) <= 1,
    }


def _diagnose(crawl: dict, root_url: str) -> dict:
    pages = crawl["pages"]
    robots = crawl["robots"]
    sitemap = crawl["sitemap"]

    # Group titles + metas to find duplicates.
    titles: dict[str, list[str]] = {}
    metas: dict[str, list[str]] = {}
    for p in pages:
        if not p.get("title"):
            continue
        if p.get("status") != 200:
            continue
        titles.setdefault(p["title"], []).append(p["url"])
        if p.get("meta_description"):
            metas.setdefault(p["meta_description"], []).append(p["url"])

    duplicate_titles = [
        {"title": t, "urls": urls} for t, urls in titles.items() if len(urls) > 1
    ]
    duplicate_metas = [
        {"meta": m, "urls": urls} for m, urls in metas.items() if len(urls) > 1
    ]

    pages_missing_meta = [p["url"] for p in pages if p.get("status") == 200 and not p.get("meta_description")]
    pages_missing_h1 = [p["url"] for p in pages if p.get("status") == 200 and not p.get("h1_count")]
    pages_missing_canonical = [p["url"] for p in pages if p.get("status") == 200 and not p.get("canonical")]
    pages_thin = [p["url"] for p in pages if p.get("status") == 200 and (p.get("word_count") or 0) < _THIN_WORD_THRESHOLD]
    pages_multi_h1 = [p["url"] for p in pages if (p.get("h1_count") or 0) > 1]
    pages_no_og = [p["url"] for p in pages if p.get("status") == 200 and not (p.get("og") or {}).get("image")]
    pages_no_schema = [p["url"] for p in pages if p.get("status") == 200 and not p.get("schema_types")]
    pages_4xx = [p["url"] for p in pages if 400 <= (p.get("status") or 0) < 500]
    pages_5xx = [p["url"] for p in pages if (p.get("status") or 0) >= 500]
    slow_pages = [p["url"] for p in pages if (p.get("response_ms") or 0) > 1500]

    pages_no_favicon = [p["url"] for p in pages if p.get("status") == 200 and not p.get("favicon")]
    pages_no_charset = [p["url"] for p in pages if p.get("status") == 200 and not p.get("charset")]
    pages_no_doctype = [p["url"] for p in pages if p.get("status") == 200 and not p.get("doctype")]
    pages_no_compression = [p["url"] for p in pages if p.get("status") == 200 and not (p.get("compression"))]
    pages_with_session = [p["url"] for p in pages if p.get("url_has_session_id")]
    pages_with_redirects = [p["url"] for p in pages if p.get("redirected")]
    pages_long_title = [p["url"] for p in pages if (p.get("title_pixel_width") or 0) > _TITLE_PIXEL_MAX]
    pages_long_meta = [p["url"] for p in pages if (p.get("meta_description_pixel_width") or 0) > _META_PIXEL_MAX]
    pages_short_meta = [
        p["url"] for p in pages
        if p.get("status") == 200 and p.get("meta_description")
        and (p.get("meta_description_pixel_width") or 0) < 400
    ]
    pages_high_stop_word = [p["url"] for p in pages if (p.get("stop_word_pct") or 0) > 35]

    site = {
        "https": root_url.startswith("https://"),
        "origin": crawl["origin"],
        "robots_txt": robots,
        "sitemap_xml": sitemap,
        "www_canonicalization": _www_canonicalization(crawl["origin"]),
        "duplicate_titles": duplicate_titles,
        "duplicate_metas": duplicate_metas,
        "pages_missing_meta": pages_missing_meta,
        "pages_missing_h1": pages_missing_h1,
        "pages_missing_canonical": pages_missing_canonical,
        "pages_multi_h1": pages_multi_h1,
        "pages_thin": pages_thin,
        "pages_no_og_image": pages_no_og,
        "pages_no_schema": pages_no_schema,
        "pages_4xx": pages_4xx,
        "pages_5xx": pages_5xx,
        "slow_pages": slow_pages,
        "pages_no_favicon": pages_no_favicon,
        "pages_no_charset": pages_no_charset,
        "pages_no_doctype": pages_no_doctype,
        "pages_no_compression": pages_no_compression,
        "pages_with_session_id": pages_with_session,
        "pages_with_redirects": pages_with_redirects,
        "pages_long_title": pages_long_title,
        "pages_long_meta": pages_long_meta,
        "pages_short_meta": pages_short_meta,
        "pages_high_stop_word_density": pages_high_stop_word,
    }
    return site


def _score(pages: list[dict], site: dict) -> dict:
    """Each axis in 0-100. Anchored to deductive penalties so the math is auditable."""
    indexable = [p for p in pages if p.get("status") == 200]
    n = max(len(indexable), 1)

    # --- Technical: status codes, https, canonicals, robots, sitemap.
    tech = 100
    if not site["https"]:
        tech -= 30
    if not site["robots_txt"].get("present"):
        tech -= 10
    if not site["sitemap_xml"].get("present"):
        tech -= 15
    tech -= min(20, 10 * len(site["pages_4xx"]))
    tech -= min(20, 15 * len(site["pages_5xx"]))
    tech -= round(20 * len(site["pages_missing_canonical"]) / n)

    # --- Content: titles, metas, h1s, thin pages.
    content = 100
    miss_title = sum(1 for p in indexable if not p.get("title"))
    content -= round(40 * miss_title / n)
    content -= round(20 * len(site["pages_missing_meta"]) / n)
    content -= round(20 * len(site["pages_missing_h1"]) / n)
    content -= round(10 * len(site["pages_thin"]) / n)
    content -= min(15, 5 * len(site["duplicate_titles"]))
    content -= min(10, 3 * len(site["duplicate_metas"]))

    # --- Structured data: JSON-LD coverage + og + twitter.
    schema = 100
    schema -= round(50 * len(site["pages_no_schema"]) / n)
    schema -= round(20 * len(site["pages_no_og_image"]) / n)
    no_twitter = sum(1 for p in indexable if not (p.get("twitter") or {}).get("card"))
    schema -= round(20 * no_twitter / n)

    # --- Performance: response time + page weight + image alts.
    perf = 100
    avg_ms = sum((p.get("response_ms") or 0) for p in indexable) / n
    if avg_ms > 800: perf -= 10
    if avg_ms > 1500: perf -= 15
    if avg_ms > 2500: perf -= 15
    big_pages = sum(1 for p in indexable if (p.get("byte_size") or 0) > 1_500_000)
    perf -= min(20, 10 * big_pages)
    low_alt = sum(1 for p in indexable if (p.get("img_alt_pct") or 100) < 60)
    perf -= round(20 * low_alt / n)

    technical = max(0, min(100, tech))
    content = max(0, min(100, content))
    structured = max(0, min(100, schema))
    performance = max(0, min(100, perf))
    overall = round((technical + content + structured + performance) / 4)
    return {
        "technical": technical,
        "content": content,
        "structured_data": structured,
        "performance": performance,
        "overall": overall,
    }


def _build_checks(pages: list[dict], site: dict, scores: dict) -> list[dict]:
    n = max(len([p for p in pages if p.get("status") == 200]), 1)

    def ok(item: str, condition: bool, note: str = "") -> dict:
        d = {"item": item, "ok": bool(condition)}
        if note and not condition:
            d["note"] = note
        return d

    indexable_pages = [p for p in pages if p.get("status") == 200]
    has_any_h2 = any(p.get("h2_count") for p in indexable_pages)
    high_param_pages = sum(1 for p in indexable_pages if (p.get("url_param_count") or 0) >= 3)
    avg_response = round(sum(p.get("response_ms") or 0 for p in indexable_pages) / max(len(indexable_pages), 1))
    pages_thin_content = sum(1 for p in indexable_pages if (p.get("paragraph_count") or 0) < 3)
    pages_long_sent = sum(1 for p in indexable_pages if (p.get("avg_sentence_length") or 0) > 25)

    return [
        # --- Transport + reachability
        ok("HTTPS enabled", site["https"]),
        ok(
            "www / non-www unified",
            site["www_canonicalization"].get("unified", True),
            "both www and non-www resolve — pick one canonical host and 301 the other",
        ),
        ok("robots.txt present", site["robots_txt"].get("present"), "no /robots.txt — search engines guess what to crawl"),
        ok("sitemap.xml present", site["sitemap_xml"].get("present"), "no /sitemap.xml — slows discovery of new pages"),
        ok("sitemap referenced in robots.txt", bool(site["robots_txt"].get("sitemaps")), "add `Sitemap:` directive to robots.txt"),
        ok("No 4xx responses", not site["pages_4xx"], f"{len(site['pages_4xx'])} URLs returned 4xx"),
        ok("No 5xx responses", not site["pages_5xx"], f"{len(site['pages_5xx'])} URLs returned 5xx"),
        ok(
            "Gzip / Brotli compression on",
            not site["pages_no_compression"],
            f"{len(site['pages_no_compression'])} pages served uncompressed — wastes bytes + LCP",
        ),

        # --- Titles & metas
        ok("Every page has a <title>", all(p.get("title") for p in indexable_pages), "missing on at least one page"),
        ok(
            "All titles ≤ 580px wide",
            not site["pages_long_title"],
            f"{len(site['pages_long_title'])} titles exceed Google's SERP truncation width",
        ),
        ok("No duplicate titles", not site["duplicate_titles"], f"{len(site['duplicate_titles'])} groups share text"),
        ok(
            "Every page has a meta description",
            not site["pages_missing_meta"],
            f"{len(site['pages_missing_meta'])} of {n} pages have none",
        ),
        ok(
            "All meta descriptions ≤ 990px",
            not site["pages_long_meta"],
            f"{len(site['pages_long_meta'])} meta descriptions exceed the SERP truncation width",
        ),
        ok(
            "Meta descriptions are not too short",
            not site["pages_short_meta"],
            f"{len(site['pages_short_meta'])} meta descriptions are under 400px wide",
        ),
        ok(
            "No duplicate meta descriptions",
            not site["duplicate_metas"],
            f"{len(site['duplicate_metas'])} meta groups are duplicated",
        ),

        # --- Headings & content
        ok(
            "Every page has exactly one H1",
            not site["pages_missing_h1"] and not site["pages_multi_h1"],
            f"{len(site['pages_missing_h1'])} missing, {len(site['pages_multi_h1'])} have multiple",
        ),
        ok("At least one H2 on every indexed page", has_any_h2, "some pages have zero H2 — flat outline hurts topical clarity"),
        ok(
            "No thin-content pages",
            not site["pages_thin"],
            f"{len(site['pages_thin'])} pages under {_THIN_WORD_THRESHOLD} words",
        ),
        ok("Pages have ≥3 paragraphs", pages_thin_content == 0, f"{pages_thin_content} pages have <3 paragraphs"),
        ok("Stop-word density < 35%", not site["pages_high_stop_word_density"], f"{len(site['pages_high_stop_word_density'])} pages above 35%"),
        ok("Average sentence length 10-25", pages_long_sent == 0, f"{pages_long_sent} pages average >25 words/sentence"),

        # --- Crawlability & canonical
        ok(
            "Every page declares a canonical",
            not site["pages_missing_canonical"],
            f"{len(site['pages_missing_canonical'])} of {n} pages have no <link rel=\"canonical\">",
        ),
        ok("URLs have no session IDs", not site["pages_with_session_id"], f"{len(site['pages_with_session_id'])} URLs contain session IDs"),
        ok("URLs have <3 query parameters", high_param_pages == 0, f"{high_param_pages} URLs have 3+ params"),

        # --- Structured + social
        ok(
            "JSON-LD structured data present",
            not site["pages_no_schema"],
            f"{len(site['pages_no_schema'])} of {n} pages have no schema",
        ),
        ok(
            "Open Graph image set",
            not site["pages_no_og_image"],
            f"{len(site['pages_no_og_image'])} pages lack og:image",
        ),
        ok(
            "Twitter card declared",
            all((p.get("twitter") or {}).get("card") for p in indexable_pages),
            "missing twitter:card meta",
        ),

        # --- HTML hygiene
        ok("DOCTYPE declared", not site["pages_no_doctype"], f"{len(site['pages_no_doctype'])} pages missing <!DOCTYPE html>"),
        ok("Charset declared", not site["pages_no_charset"], f"{len(site['pages_no_charset'])} pages missing meta charset"),
        ok("Favicon linked", not site["pages_no_favicon"], f"{len(site['pages_no_favicon'])} pages have no favicon"),
        ok("Viewport meta set", all(p.get("viewport") for p in indexable_pages), "missing viewport on at least one page"),
        ok("HTML lang attribute set", all(p.get("lang") for p in indexable_pages), "<html> tag missing lang= on at least one page"),
        ok(
            "All images have alt text",
            all((p.get("img_alt_pct") or 100) >= 90 for p in indexable_pages if p.get("img_total")),
            "some pages have under 90% image alt coverage",
        ),

        # --- Performance
        ok(
            "Pages load in <1.5s on first byte",
            not site["slow_pages"],
            f"{len(site['slow_pages'])} pages had a response above 1.5s — Core Web Vitals risk",
        ),
        ok(
            "Average TTFB under 800ms",
            avg_response < 800,
            f"site-wide average TTFB is {avg_response}ms",
        ),

        # --- Overall
        ok(
            "Overall SEO score ≥ 70",
            (scores["overall"] or 0) >= 70,
            f"current score is {scores['overall']}/100",
        ),
    ]


# ---- LLM section (top-of-funnel narrative) -----------------------------------

_PROMPT = (
    "You are a senior SEO consultant writing an executive summary. Below is a "
    "structured crawl of a real website. Read it carefully — every number is real. "
    "Return ONLY valid JSON with this shape: "
    "{\"sections\": [{\"title\": str, \"finding\": str, \"recommendations\": [str]}], "
    "\"opportunities\": [{\"title\": str, \"severity\": \"high|medium|low\", "
    "\"surface\": str, \"effort\": \"low|medium|high\", \"impact\": \"low|medium|high\", "
    "\"note\": str}], "
    "\"conclusion\": [str]}. "
    "Rules: "
    "(a) 5-7 `sections` covering the most impactful real issues, in priority order. "
    "Each `finding` must quote specific URLs / titles / numbers from the crawl. "
    "(b) 5-9 `opportunities` — short, actionable, sortable by impact * (1/effort). "
    "(c) 5-7 `conclusion` bullets — what to do this week. "
    "Do NOT invent pages or numbers. Only reference what's in the crawl."
)


def _llm_sections(crawl_summary: dict, *, provider: str = "anthropic",
                  api_key: str | None = None, model: str | None = None) -> dict | None:
    payload = json.dumps(crawl_summary)[:24000]
    prompt = f"{_PROMPT}\n\nCRAWL:\n{payload}"
    text: str | None
    if (provider or "anthropic").lower() == "openai":
        key = (api_key or settings.OPENAI_API_KEY or "").strip()
        if not key:
            return None
        mdl = (model or settings.OPENAI_MODEL or "gpt-4o").strip()
        try:
            r = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": mdl, "max_tokens": 4500,
                      "messages": [{"role": "user", "content": prompt}]},
                timeout=60,
            )
            r.raise_for_status()
            text = r.json()["choices"][0]["message"]["content"]
        except Exception:  # noqa: BLE001
            return None
    else:
        key = (api_key or settings.ANTHROPIC_API_KEY or "").strip()
        if not key:
            return None
        mdl = (model or settings.ANTHROPIC_MODEL or "claude-sonnet-4-6").strip()
        try:
            r = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                         "content-type": "application/json"},
                json={"model": mdl, "max_tokens": 4500,
                      "messages": [{"role": "user", "content": prompt}]},
                timeout=60,
            )
            r.raise_for_status()
            text = r.json()["content"][0]["text"]
        except Exception:  # noqa: BLE001
            return None

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


# ---- canned fallback (when no API key / LLM fails) ---------------------------

def _fallback_narrative(site: dict, scores: dict, pages: list[dict]) -> dict:
    n = max(len([p for p in pages if p.get("status") == 200]), 1)
    sections: list[dict] = []

    if site["pages_missing_meta"]:
        sections.append({
            "title": "Missing meta descriptions",
            "finding": (
                f"{len(site['pages_missing_meta'])} of {n} crawled pages have no <meta name=\"description\">. "
                "Google generates one from page text — usually picks something off-brand."
            ),
            "recommendations": [
                "Write a 140-160 char meta description for every indexable page.",
                "Lead with the primary keyword + a buyer-benefit phrase.",
                "Avoid stop-word stuffing; write for humans, the snippet matters.",
            ],
        })

    if site["pages_missing_h1"] or site["pages_multi_h1"]:
        sections.append({
            "title": "H1 structure problems",
            "finding": (
                f"{len(site['pages_missing_h1'])} pages have no H1 and {len(site['pages_multi_h1'])} pages "
                "have multiple H1s. Modern Google can handle multiple H1s, but a single, keyword-aligned H1 "
                "still beats both extremes on topical clarity."
            ),
            "recommendations": [
                "Ensure every page has exactly one H1 that includes the primary intent keyword.",
                "Demote secondary headings to H2/H3 — don't promote them to H1 for styling.",
            ],
        })

    if site["duplicate_titles"]:
        sections.append({
            "title": "Duplicate page titles",
            "finding": (
                f"{len(site['duplicate_titles'])} title groups share text across multiple URLs. "
                "Search engines collapse duplicate-titled pages, splitting rankings between them."
            ),
            "recommendations": [
                "Rewrite each duplicate title to reflect the page's unique intent.",
                "Use a 'Page Title — Brand' template that varies the leading clause.",
            ],
        })

    if site["pages_no_schema"]:
        sections.append({
            "title": "Structured data coverage is low",
            "finding": (
                f"{len(site['pages_no_schema'])} of {n} pages have no JSON-LD schema. "
                "Schema is required for rich result eligibility (FAQ, Product, Breadcrumb, Organization)."
            ),
            "recommendations": [
                "Add Organization + WebSite schema to the homepage at minimum.",
                "Add BreadcrumbList to category and detail pages.",
                "Add Product (price, availability, rating) to PDPs if applicable.",
            ],
        })

    if not site["sitemap_xml"].get("present"):
        sections.append({
            "title": "No sitemap.xml detected",
            "finding": "No /sitemap.xml or /sitemap_index.xml is reachable. Search engines have to discover pages by following links.",
            "recommendations": [
                "Publish a sitemap.xml at /sitemap.xml with every indexable URL.",
                "Reference it from robots.txt via `Sitemap: …`.",
                "Submit it in Google Search Console.",
            ],
        })

    if site["slow_pages"]:
        sections.append({
            "title": "Slow first-byte time on " + ("multiple pages" if len(site["slow_pages"]) > 1 else "one page"),
            "finding": (
                f"{len(site['slow_pages'])} pages responded above 1.5s. Server response is a Core Web Vitals input — "
                "Google rolls a slow TTFB into the LCP metric and ranks it down on mobile."
            ),
            "recommendations": [
                "Cache the HTML at the edge (Vercel, Cloudflare) for logged-out visitors.",
                "Render-block fewer scripts in <head>; defer non-critical JS.",
            ],
        })

    opps = []
    if site["pages_missing_meta"]:
        opps.append({"title": "Write missing meta descriptions", "severity": "high", "surface": "content",
                     "effort": "low", "impact": "medium",
                     "note": f"{len(site['pages_missing_meta'])} pages affected"})
    if site["pages_no_schema"]:
        opps.append({"title": "Add JSON-LD Organization schema", "severity": "medium", "surface": "structured_data",
                     "effort": "low", "impact": "medium",
                     "note": "unlocks brand-search rich results"})
    if not site["sitemap_xml"].get("present"):
        opps.append({"title": "Publish a sitemap.xml", "severity": "medium", "surface": "technical",
                     "effort": "low", "impact": "medium",
                     "note": "speeds crawl discovery by 2-3x"})
    if site["pages_missing_canonical"]:
        opps.append({"title": "Add canonical tags", "severity": "medium", "surface": "technical",
                     "effort": "low", "impact": "medium",
                     "note": f"{len(site['pages_missing_canonical'])} pages affected"})
    if site["duplicate_titles"]:
        opps.append({"title": "Differentiate duplicate titles", "severity": "high", "surface": "content",
                     "effort": "medium", "impact": "high",
                     "note": "duplicate titles cap ranking ceiling"})

    conclusion = []
    if site["pages_missing_meta"]:
        conclusion.append("Write meta descriptions for every indexable page.")
    if site["pages_no_schema"]:
        conclusion.append("Add JSON-LD schema starting with Organization on the homepage.")
    if not site["sitemap_xml"].get("present"):
        conclusion.append("Publish a sitemap.xml and reference it from robots.txt.")
    if site["pages_missing_canonical"]:
        conclusion.append("Add canonical link tags to every page.")
    if scores["performance"] < 80:
        conclusion.append("Optimize server response time; consider edge caching.")
    if not conclusion:
        conclusion.append("Site looks healthy on the basics — keep growing internal links + content depth.")

    return {"sections": sections, "opportunities": opps, "conclusion": conclusion}


# ---- public entry ------------------------------------------------------------

def _persisted_pages(pages: list[dict]) -> list[dict]:
    """Strip per-page heavy fields (_html, _text) before storing on the Audit row."""
    out: list[dict] = []
    for p in pages:
        clean = {k: v for k, v in p.items() if not k.startswith("_")}
        out.append(clean)
    return out


def _findings_from_report(report: dict) -> list[dict]:
    """Convert report.opportunities → legacy `findings[]` so the variant
    generator + short-form SEO views still work."""
    findings: list[dict] = []
    for o in report.get("opportunities") or []:
        sev = o.get("severity") or "medium"
        findings.append({
            "surface": o.get("surface") or "seo",
            "severity": sev if sev in {"high", "medium", "low"} else "medium",
            "label": o.get("title") or "seo opportunity",
            "note": o.get("note") or "",
            "predicted_lift_pct": 0,
        })
    return findings[:8]


def run_seo_audit(url: str, *, provider: str = "anthropic",
                  api_key: str | None = None, model: str | None = None) -> dict:
    """Public entry. Returns a dict ready to merge into the Audit row."""
    started = time.monotonic()

    try:
        crawl = _crawl(url)
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "failed",
            "error": f"could not crawl: {exc}",
            "elapsed_ms": int((time.monotonic() - started) * 1000),
        }

    pages = crawl["pages"]
    if not pages or pages[0].get("status") != 200:
        return {
            "status": "failed",
            "error": "homepage did not return 200",
            "elapsed_ms": int((time.monotonic() - started) * 1000),
        }

    home = pages[0]
    site = _diagnose(crawl, url)
    scores = _score(pages, site)
    checks = _build_checks(pages, site, scores)

    # Build a compact summary for the LLM. We pass the deterministic facts
    # (URLs, titles, status codes, scores) so the LLM never has to invent.
    summary_for_llm = {
        "root_url": url,
        "scores": scores,
        "site": {
            "https": site["https"],
            "robots_txt": site["robots_txt"],
            "sitemap_xml": {k: site["sitemap_xml"].get(k) for k in ("present", "url_count", "sample")},
            "duplicate_titles": site["duplicate_titles"],
            "duplicate_metas": [{"meta": m["meta"][:120], "urls": m["urls"]} for m in site["duplicate_metas"]],
            "pages_missing_meta": site["pages_missing_meta"],
            "pages_missing_h1": site["pages_missing_h1"],
            "pages_missing_canonical": site["pages_missing_canonical"],
            "pages_no_schema": site["pages_no_schema"],
            "pages_4xx": site["pages_4xx"],
            "slow_pages": site["slow_pages"],
        },
        "pages": [
            {
                "url": p.get("url"),
                "status": p.get("status"),
                "title": p.get("title"),
                "title_length": p.get("title_length"),
                "meta_description_length": p.get("meta_description_length"),
                "h1": p.get("h1"),
                "h1_count": p.get("h1_count"),
                "word_count": p.get("word_count"),
                "schema_types": p.get("schema_types"),
                "response_ms": p.get("response_ms"),
                "indexable": p.get("indexable"),
            }
            for p in pages
        ],
    }

    narrative = _llm_sections(summary_for_llm, provider=provider, api_key=api_key, model=model)
    if not narrative:
        narrative = _fallback_narrative(site, scores, pages)

    # Homepage SERP-preview mock (Google truncates at the pixel widths above).
    search_preview = {
        "url": home.get("url", url),
        "title": home.get("title", "") or url,
        "title_pixel_width": home.get("title_pixel_width", 0),
        "title_truncated": (home.get("title_pixel_width") or 0) > _TITLE_PIXEL_MAX,
        "description": home.get("meta_description") or "",
        "description_pixel_width": home.get("meta_description_pixel_width", 0),
        "description_truncated": (home.get("meta_description_pixel_width") or 0) > _META_PIXEL_MAX,
        "favicon": home.get("favicon", ""),
        "host": urlparse(home.get("url", url)).hostname or "",
    }

    # Aggregate the homepage's top keywords (already extracted per page).
    top_keywords = (home.get("keywords") or [])[:10]

    # Site-wide content stats summary.
    indexable = [p for p in pages if p.get("status") == 200]
    n_idx = max(len(indexable), 1)
    content_stats = {
        "avg_word_count": round(sum(p.get("word_count") or 0 for p in indexable) / n_idx),
        "avg_paragraph_count": round(sum(p.get("paragraph_count") or 0 for p in indexable) / n_idx, 1),
        "avg_sentence_length": round(sum(p.get("avg_sentence_length") or 0 for p in indexable) / n_idx, 1),
        "avg_stop_word_pct": round(sum(p.get("stop_word_pct") or 0 for p in indexable) / n_idx),
        "avg_response_ms": round(sum(p.get("response_ms") or 0 for p in indexable) / n_idx),
        "avg_byte_size": round(sum(p.get("byte_size") or 0 for p in indexable) / n_idx),
        "avg_internal_links": round(sum(p.get("internal_links") or 0 for p in indexable) / n_idx),
        "total_schemas_found": sum(len(p.get("schema_types") or []) for p in indexable),
        "unique_schema_types": sorted({s for p in indexable for s in (p.get("schema_types") or [])}),
    }

    report = {
        "scores": scores,
        "pages": _persisted_pages(pages),
        "site": site,
        "checks": checks,
        "search_preview": search_preview,
        "top_keywords": top_keywords,
        "content_stats": content_stats,
        "sections": narrative.get("sections") or [],
        "opportunities": narrative.get("opportunities") or [],
        "conclusion": narrative.get("conclusion") or [],
    }

    elapsed_ms = int((time.monotonic() - started) * 1000)
    findings = _findings_from_report(report)

    summary = (
        f"Crawled {len(pages)} pages on {url}. Overall SEO score {scores['overall']}/100 "
        f"(tech {scores['technical']} · content {scores['content']} · schema {scores['structured_data']} · "
        f"perf {scores['performance']}). {len(narrative.get('sections') or [])} priority sections, "
        f"{sum(1 for c in checks if not c['ok'])} of {len(checks)} checks failing."
    )

    return {
        "status": "done",
        "page_title": home.get("title", ""),
        "summary": summary,
        "findings": findings,
        "report": report,
        "elapsed_ms": elapsed_ms,
        "error": "",
    }
