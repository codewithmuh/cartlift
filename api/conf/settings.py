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

# Database — prefer DATABASE_URL (Vercel/Neon/Railway/Render), fall back to
# discrete POSTGRES_* env vars for local docker-compose. dj-database-url
# parses the connection string and dispatches to the right backend.
import dj_database_url  # noqa: E402

_database_url = env("DATABASE_URL") or env("POSTGRES_URL")
if _database_url:
    DATABASES = {
        "default": dj_database_url.parse(
            _database_url,
            conn_max_age=600,
            conn_health_checks=True,
            ssl_require=True,  # Neon + most managed Postgres require SSL
        ),
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            # Neon (via Vercel) sets POSTGRES_DATABASE; docker-compose sets POSTGRES_DB.
            "NAME": env("POSTGRES_DB") or env("POSTGRES_DATABASE") or "cartlift",
            "USER": env("POSTGRES_USER", "cartlift"),
            "PASSWORD": env("POSTGRES_PASSWORD", "cartlift_dev"),
            "HOST": env("POSTGRES_HOST", "db"),
            "PORT": env("POSTGRES_PORT", "5432"),
        }
    }

# Add Vercel's auto-assigned hostname so the deployment passes ALLOWED_HOSTS.
if env("VERCEL_URL"):
    ALLOWED_HOSTS.append(env("VERCEL_URL"))
    ALLOWED_HOSTS.append(".vercel.app")  # any preview URL

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
# Match every Vercel preview URL (cartlift-<hash>-<team>.vercel.app) without
# having to enumerate them. Production origin still goes through CORS_ALLOWED_ORIGINS.
CORS_ALLOWED_ORIGIN_REGEXES = [r"^https://cartlift-.*\.vercel\.app$"]
CORS_ALLOW_CREDENTIALS = True
# Restrict corsheaders to /api/* — snippet routes (/s/*) set their own CORS:* headers
# so they can be loaded from any customer domain.
CORS_URLS_REGEX = r"^/api/.*$"
