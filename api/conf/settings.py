"""Bandit API — Django settings. Env-driven."""
from datetime import timedelta
from pathlib import Path
import os

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=False)


def env(key: str, default: str | None = None) -> str:
    return os.environ.get(key, default)  # type: ignore[return-value]


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-secret-not-for-prod")
DEBUG = env("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()]

# LLM provider keys + default models for audits. Server-side only — never
# exposed to clients. Per-user keys/models on the User model take precedence;
# these are the fallback used when a user hasn't configured their own.
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = env("ANTHROPIC_MODEL", "claude-sonnet-4-6")
OPENAI_API_KEY = env("OPENAI_API_KEY", "")
OPENAI_MODEL = env("OPENAI_MODEL", "gpt-4o")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "accounts",
    "sites",
    "experiments",
    "audits",
    "snippet",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "conf.urls"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {
        "context_processors": [
            "django.template.context_processors.request",
            "django.contrib.auth.context_processors.auth",
            "django.contrib.messages.context_processors.messages",
        ],
    },
}]

WSGI_APPLICATION = "conf.wsgi.application"

# Database — prefer DATABASE_URL when present (Vercel/Neon/Railway/Render
# style), fall back to discrete POSTGRES_* env vars for local docker-compose.
# Neon also exposes POSTGRES_DATABASE (note: not POSTGRES_DB) via Vercel.
def _db_from_url(url: str) -> dict:
    from urllib.parse import urlparse, unquote
    u = urlparse(url)
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": (u.path or "/").lstrip("/") or "postgres",
        "USER": unquote(u.username or ""),
        "PASSWORD": unquote(u.password or ""),
        "HOST": u.hostname or "",
        "PORT": str(u.port or 5432),
    }


_database_url = env("DATABASE_URL") or env("POSTGRES_URL")
if _database_url:
    DATABASES = {"default": _db_from_url(_database_url)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("POSTGRES_DB") or env("POSTGRES_DATABASE") or "cartlift",
            "USER": env("POSTGRES_USER", "cartlift"),
            "PASSWORD": env("POSTGRES_PASSWORD", "cartlift_dev"),
            "HOST": env("POSTGRES_HOST", "db"),
            "PORT": env("POSTGRES_PORT", "5432"),
        }
    }

# Neon (and any non-localhost managed Postgres) requires SSL.
_db_host = DATABASES["default"]["HOST"]
if _db_host and _db_host not in {"localhost", "127.0.0.1", "db"}:
    DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = "require"

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
    ),
    # Default rates apply project-wide. Per-view scopes (e.g. "audit-run",
    # "audit-public") override these via ScopedRateThrottle on the view.
    "DEFAULT_THROTTLE_RATES": {
        "user": "300/hour",
        "anon": "60/hour",
        "audit-run": "20/hour",      # authed: paid Claude calls — cap the budget burn
        "audit-public": "5/hour",    # unauth: shareable preview audits from the landing page
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = [
    o.strip() for o in env(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3050,http://127.0.0.1:3050",
    ).split(",") if o.strip()
]
CORS_ALLOW_CREDENTIALS = True
# Restrict corsheaders to /api/* — snippet routes (/s/*) set their own CORS:* headers
# so they can be loaded from any customer domain.
CORS_URLS_REGEX = r"^/api/.*$"
