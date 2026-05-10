"""Variant generator — turns CRO audit findings into draft Experiments + Variants.

For each finding (e.g. "vague headline · +18.3% predicted lift"), this creates:
  * 1 Experiment in `draft` status, named after the finding label
  * 1 control Variant (the original page text — empty body, never applied)
  * 2-3 candidate Variants drafted by Claude (or canned fallback)

The user then reviews and approves drafts via the dashboard. Approved drafts
flip to `trial` status and the snippet picks them up on the next page load.
"""
from __future__ import annotations

import json
import re
from typing import Any

import requests
from django.conf import settings

from experiments.models import Experiment, Variant


_CANNED_VARIANTS = {
    "hero_headline": [
        ("Sharper category claim", "Conversion software for {category}. Your team will ship."),
        ("Outcome-led headline", "Stop guessing what works on your site. Ship the variants that do."),
        ("Loss-aversion lead", "Stop losing 67% of your visitors at the headline."),
    ],
    "hero_cta": [
        ("Imperative + outcome", "Get my audit →"),
        ("Specificity ladder", "Get a free 30-second audit"),
    ],
    "social_proof": [
        ("Numeric proof bar", '<div style="display:flex;gap:1rem;align-items:center;"><strong>2,000+ sites</strong> · <strong>5M+ visits scored</strong></div>'),
        ("Three-logo strip", '<div>Trusted by teams at <strong>Acme</strong> · <strong>Apex</strong> · <strong>Anvil</strong></div>'),
    ],
    "pricing": [
        ("Inline price disclosure", "From $49/mo · cancel any time."),
    ],
    "checkout": [
        ("Trust under CTA", "<small>Secure checkout · 30-day refund · No card stored</small>"),
    ],
}


def _claude_variants(finding: dict[str, Any], n: int = 3) -> list[tuple[str, str]] | None:
    """Ask Claude for N candidate variants. Returns [(name, body), ...] or None."""
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        return None

    prompt = (
        "You are a CRO copywriter. The audit found this issue on a marketing site:\n\n"
        f"Surface: {finding.get('surface')}\n"
        f"Issue: {finding.get('label')}\n"
        f"Note: {finding.get('note')}\n"
        f"Predicted lift: +{finding.get('predicted_lift_pct', 0)}%\n\n"
        f"Draft {n} candidate replacement variants for this surface. Output ONLY a JSON "
        "array of objects with: name (3-6 words describing the strategy), body (the actual "
        "HTML/text to render). Keep bodies tight — under 200 chars each."
    )
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
                "max_tokens": 1500,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        r.raise_for_status()
        text = r.json()["content"][0]["text"]
        match = re.search(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL)
        if not match:
            return None
        data = json.loads(match.group(0))
        return [(v["name"], v["body"]) for v in data if "name" in v and "body" in v]
    except Exception:  # noqa: BLE001
        return None


def generate_for_audit(audit, site, *, max_experiments: int = 5) -> list[Experiment]:
    """Create draft experiments + variants from a CRO audit's findings.

    Returns the list of newly created Experiments.
    """
    if audit.audit_type not in {"cro", "seo"}:
        # SEO/CRO findings have a `surface` we can target. Compliance/GMC don't.
        return []

    out: list[Experiment] = []
    for f in (audit.findings or [])[:max_experiments]:
        surface = f.get("surface") or "custom"
        label = f.get("label") or "untitled"

        candidates = _claude_variants(f, n=3) or _CANNED_VARIANTS.get(surface, [
            ("Aurea-style alt", "Variant copy goes here — replace before approving."),
        ])

        exp = Experiment.objects.create(
            site=site,
            name=f"{surface} · {label}",
            surface=surface if surface in dict(Experiment.SURFACES) else "custom",
            hypothesis=f.get("note", ""),
            status="draft",
            uplift_pct=float(f.get("predicted_lift_pct") or 0),
        )
        Variant.objects.create(
            experiment=exp,
            name="control · original",
            is_control=True,
            body="",
            rationale="The original page — no changes applied.",
            weight=0.5,
        )
        per = 0.5 / max(len(candidates), 1)
        for name, body in candidates:
            Variant.objects.create(
                experiment=exp,
                name=name,
                body=body,
                rationale=f.get("note", ""),
                weight=per,
            )
        out.append(exp)

    return out
