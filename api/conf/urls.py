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


@csrf_exempt
def run_migrate(request):
    """Run `manage.py migrate` over HTTP. Protected by MIGRATE_TOKEN env var
    so it's only callable by someone who set the token. If the token is unset
    the endpoint refuses to do anything — never accidentally world-readable.

        curl -X POST -H 'X-Migrate-Token: <token>' \\
             https://api.cartlift.codewithmuh.com/api/admin/migrate
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    expected = (os.environ.get("MIGRATE_TOKEN") or "").strip()
    if not expected:
        return HttpResponseForbidden("MIGRATE_TOKEN is unset on the server")
    got = (request.headers.get("X-Migrate-Token")
           or request.GET.get("token") or "").strip()
    if got != expected:
        return HttpResponseForbidden("bad migrate token")
    buf = io.StringIO()
    try:
        call_command("migrate", interactive=False, stdout=buf, stderr=buf)
        return JsonResponse({"status": "ok", "output": buf.getvalue()})
    except Exception as exc:  # noqa: BLE001 — surface the error to the operator
        return JsonResponse(
            {"status": "failed", "error": repr(exc), "output": buf.getvalue()},
            status=500,
        )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),
    path("api/admin/migrate", run_migrate),
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
