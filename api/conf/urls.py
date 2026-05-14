import io
import os

from django.contrib import admin
from django.core.management import call_command
from django.http import JsonResponse, HttpResponseForbidden, HttpResponseNotAllowed
from django.urls import path, include
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.views import TokenRefreshView


def health(_request):
    return JsonResponse({"status": "ok", "service": "cartlift-api"})


def _is_authed_admin_call(request) -> bool:
    """Allow request when ONE of the following matches:
       1. Authorization: Bearer <CRON_SECRET>  ← used by Vercel Cron automatically
       2. X-Migrate-Token: <MIGRATE_TOKEN>     ← used by humans curling the endpoint
       3. ?token=<MIGRATE_TOKEN>               ← query-string fallback
    """
    cron_secret = (os.environ.get("CRON_SECRET") or "").strip()
    migrate_token = (os.environ.get("MIGRATE_TOKEN") or "").strip()
    auth_header = (request.headers.get("Authorization") or "").strip()
    if cron_secret and auth_header == f"Bearer {cron_secret}":
        return True
    if migrate_token:
        got = (request.headers.get("X-Migrate-Token")
               or request.GET.get("token") or "").strip()
        if got == migrate_token:
            return True
    return False


@csrf_exempt
def run_migrate(request):
    """Run `manage.py migrate` over HTTP. Protected by MIGRATE_TOKEN env var.

        curl -X POST -H 'X-Migrate-Token: <token>' \\
             https://api.cartlift.codewithmuh.com/api/admin/migrate
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    if not _is_authed_admin_call(request):
        return HttpResponseForbidden("missing or invalid admin token")
    buf = io.StringIO()
    try:
        call_command("migrate", interactive=False, stdout=buf, stderr=buf)
        return JsonResponse({"status": "ok", "output": buf.getvalue()})
    except Exception as exc:  # noqa: BLE001 — surface the error to the operator
        return JsonResponse(
            {"status": "failed", "error": repr(exc), "output": buf.getvalue()},
            status=500,
        )


@csrf_exempt
def run_allocator(request):
    """Run one allocator tick over HTTP. Called by Vercel Cron every 30 min
    (configured in vercel.json) — replaces the `scheduler` container that
    runs an infinite loop on platforms that support long-lived processes.

    Vercel Cron auths via `Authorization: Bearer <CRON_SECRET>`. Operators
    can also trigger manually via the MIGRATE_TOKEN header/query param.

    Accepts GET so Vercel Cron's default request works without config tweaks.
    """
    if request.method not in {"GET", "POST"}:
        return HttpResponseNotAllowed(["GET", "POST"])
    if not _is_authed_admin_call(request):
        return HttpResponseForbidden("missing or invalid admin token")
    # Import inside the view so a Django boot doesn't pull the experiments
    # app graph before settings finish loading.
    from experiments.models import Experiment
    from experiments.management.commands.allocate_bandits import _allocate
    qs = Experiment.objects.filter(status="trial").prefetch_related("variants")
    results = []
    for exp in qs:
        results.append(_allocate(exp))
    return JsonResponse({
        "status": "ok",
        "allocated": len(results),
        "shipped": sum(1 for r in results if r.get("shipped")),
        "results": results,
    })


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),
    path("api/admin/migrate", run_migrate),
    path("api/admin/run-allocator", run_allocator),
    path("api/auth/", include("accounts.urls")),
    path("api/auth/refresh", TokenRefreshView.as_view()),
    path("api/sites/", include("sites.urls")),
    path("api/experiments/", include("experiments.urls")),
    path("api/audits/", include("audits.urls")),
    # Public, unauthenticated audit preview — powers the /audit/<slug> share pages.
    path("api/public/audits/", include("audits.public_urls")),
    # Public snippet — no JWT, CORS open. Customer sites load these from any domain.
    path("", include("snippet.urls")),
]
