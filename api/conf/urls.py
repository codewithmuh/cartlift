from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView


def health(_request):
    return JsonResponse({"status": "ok", "service": "bandit-api"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),
    path("api/auth/", include("accounts.urls")),
    path("api/auth/refresh", TokenRefreshView.as_view()),
    path("api/sites/", include("sites.urls")),
    path("api/experiments/", include("experiments.urls")),
    path("api/audits/", include("audits.urls")),
    # Public snippet — no JWT, CORS open. Customer sites load these from any domain.
    path("", include("snippet.urls")),
]
