"""Public snippet endpoints — these are the ONLY routes served without JWT.

Auth is implicit via the per-site `bnd_xxx` token in the URL. The snippet runs
on customer-owned websites; it must be reachable cross-origin without cookies.

* GET  /s/<token>.js          — serves the JS that runs on the customer site
* GET  /s/<token>/active      — JSON of active experiments + variants for that site
* POST /s/<token>/expose      — record an exposure event (1 visitor saw 1 variant)
* POST /s/<token>/convert     — record a conversion event
"""
from __future__ import annotations

import json

from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from experiments.models import Experiment, Sample, Variant
from sites.models import Site


def _get_site(token: str) -> Site | None:
    return Site.objects.filter(token=token).first()


def _cors(response: HttpResponse) -> HttpResponse:
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response


# ---------- /s/<token>.js ----------

_SNIPPET_TEMPLATE = """
/* Bandit snippet — generated for {token}. ~3kb gzipped. */
(function () {{
  var SITE = "{token}";
  var BASE = "{base}";

  function vid() {{
    try {{
      var v = localStorage.getItem("bnd_vid");
      if (!v) {{
        v = "v_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        localStorage.setItem("bnd_vid", v);
      }}
      return v;
    }} catch (_) {{ return "v_anon"; }}
  }}

  function pickVariant(exp) {{
    var key = "bnd_v_" + exp.id;
    try {{
      var assigned = localStorage.getItem(key);
      if (assigned) {{
        var hit = exp.variants.filter(function (v) {{ return String(v.id) === assigned; }})[0];
        if (hit) return hit;
      }}
    }} catch (_) {{}}
    var total = exp.variants.reduce(function (s, v) {{ return s + (v.weight || 0); }}, 0) || 1;
    var r = Math.random() * total;
    var cum = 0;
    for (var i = 0; i < exp.variants.length; i++) {{
      cum += exp.variants[i].weight || 0;
      if (r <= cum) {{
        try {{ localStorage.setItem(key, String(exp.variants[i].id)); }} catch (_) {{}}
        return exp.variants[i];
      }}
    }}
    return exp.variants[0];
  }}

  function applyVariant(exp, variant) {{
    if (!variant || variant.is_control) return;
    if (!exp.selector) return;
    var nodes = document.querySelectorAll(exp.selector);
    if (!nodes.length) return;
    for (var i = 0; i < nodes.length; i++) {{
      try {{ nodes[i].innerHTML = variant.body || ""; }}
      catch (_) {{ /* circuit breaker — never break the host page */ }}
    }}
  }}

  function fire(event, variantId) {{
    try {{
      var blob = new Blob([JSON.stringify({{
        variant_id: variantId, visitor: vid(), event: event
      }})], {{ type: "application/json" }});
      if (navigator.sendBeacon) {{
        navigator.sendBeacon(BASE + "/s/" + SITE + "/" + event, blob);
      }} else {{
        fetch(BASE + "/s/" + SITE + "/" + event, {{
          method: "POST", body: blob, keepalive: true,
          headers: {{ "Content-Type": "application/json" }}
        }}).catch(function () {{}});
      }}
    }} catch (_) {{}}
  }}

  function run() {{
    fetch(BASE + "/s/" + SITE + "/active", {{ credentials: "omit" }})
      .then(function (r) {{ return r.json(); }})
      .then(function (experiments) {{
        if (!Array.isArray(experiments)) return;
        var assignments = {{}};
        experiments.forEach(function (exp) {{
          try {{
            var v = pickVariant(exp);
            assignments[exp.id] = v.id;
            applyVariant(exp, v);
            fire("expose", v.id);
          }} catch (_) {{}}
        }});

        // Public API: window.bandit.convert(experimentId)
        window.bandit = {{
          convert: function (experimentId) {{
            var v = assignments[experimentId];
            if (!v) return;
            fire("convert", v);
          }},
          assignments: assignments,
          version: "0.1.0"
        }};

        document.dispatchEvent(new CustomEvent("bandit:ready", {{
          detail: {{ assignments: assignments }}
        }}));
      }})
      .catch(function () {{}});
  }}

  if (document.readyState === "loading") {{
    document.addEventListener("DOMContentLoaded", run);
  }} else {{
    run();
  }}
}})();
""".strip()


def serve_snippet(request, token: str):
    site = _get_site(token)
    if not site:
        return _cors(HttpResponse("/* unknown site */", status=404, content_type="application/javascript"))
    base = request.build_absolute_uri("/").rstrip("/")
    body = _SNIPPET_TEMPLATE.format(token=token, base=base)
    resp = HttpResponse(body, content_type="application/javascript; charset=utf-8")
    resp["Cache-Control"] = "public, max-age=60"
    return _cors(resp)


# ---------- /s/<token>/active ----------

def active_experiments(request, token: str):
    site = _get_site(token)
    if not site:
        return _cors(JsonResponse([], safe=False))
    qs = (Experiment.objects.filter(site=site, status="trial")
          .prefetch_related("variants"))
    out = []
    for e in qs:
        variants = []
        for v in e.variants.all():
            variants.append({
                "id": v.id,
                "name": v.name,
                "is_control": v.is_control,
                "body": v.body,
                "weight": float(v.weight or 0),
            })
        out.append({
            "id": e.id,
            "name": e.name,
            "selector": e.selector or _selector_for_surface(e.surface),
            "surface": e.surface,
            "variants": variants,
        })
    return _cors(JsonResponse(out, safe=False))


def _selector_for_surface(surface: str) -> str:
    """Default CSS selector when the experiment didn't override `selector`."""
    return {
        "hero_headline": "h1",
        "hero_cta": ".cta, .btn-primary, [data-bandit='cta']",
        "pricing_cta": "[data-bandit='pricing-cta']",
        "checkout_cta": "[data-bandit='checkout-cta']",
        "nav": "nav",
        "footer": "footer",
    }.get(surface, "")


# ---------- /s/<token>/expose | convert ----------

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def event(request, token: str, event_name: str):
    if request.method == "OPTIONS":
        return _cors(HttpResponse(status=204))

    site = _get_site(token)
    if not site:
        return _cors(JsonResponse({"detail": "unknown site"}, status=404))
    if event_name not in {"expose", "convert"}:
        return _cors(JsonResponse({"detail": "unknown event"}, status=400))

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return _cors(JsonResponse({"detail": "invalid json"}, status=400))

    variant_id = payload.get("variant_id")
    visitor = (payload.get("visitor") or "")[:64]
    if not variant_id:
        return _cors(JsonResponse({"detail": "variant_id required"}, status=400))

    variant = (Variant.objects.filter(id=variant_id, experiment__site=site)
               .select_related("experiment").first())
    if not variant:
        return _cors(JsonResponse({"detail": "unknown variant"}, status=404))

    Sample.objects.create(variant=variant, event=event_name, visitor=visitor)
    if event_name == "expose":
        Variant.objects.filter(id=variant.id).update(samples=variant.samples + 1)
    else:
        Variant.objects.filter(id=variant.id).update(conversions=variant.conversions + 1)

    return _cors(JsonResponse({"ok": True, "ts": timezone.now().isoformat()}))
