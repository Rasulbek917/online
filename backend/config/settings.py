"""
Django settings for IT PARK ACADEMY.
Environment-driven, production-safe defaults with a development fallback.
"""
from datetime import timedelta
from pathlib import Path
import os

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-insecure-change-me-in-production")
DEBUG = env_bool("DEBUG", not bool(os.getenv("VERCEL")))
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")

# Vercel injects the deployment domains for both public and bound service calls.
VERCEL_URL = os.getenv("VERCEL_URL", "").strip()
VERCEL_PROJECT_PRODUCTION_URL = os.getenv("VERCEL_PROJECT_PRODUCTION_URL", "").strip()
_VERCEL_PUBLIC_HOST = VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL
_VERCEL_PUBLIC_URL = f"https://{_VERCEL_PUBLIC_HOST}" if _VERCEL_PUBLIC_HOST else ""
for _host in {VERCEL_URL, VERCEL_PROJECT_PRODUCTION_URL}:
    if _host and _host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_host)
if _VERCEL_PUBLIC_HOST:
    ALLOWED_HOSTS.append(".vercel.app")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "apps.users",
    "apps.courses",
    "apps.quizzes",
    "apps.payments",
    "apps.subscriptions",
    "apps.certificates",
    "apps.notifications",
    "apps.comments",
    "apps.analytics",
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
    "common.middleware.AdminAuditMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# PostgreSQL is the primary database. SQLite is available only for quick local checks.
# Vercel's Postgres/Neon integrations inject POSTGRES_URL (or DATABASE_URL).
DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRES_PRISMA_URL")
)
if env_bool("USE_SQLITE", False):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    if not DATABASE_URL:
        if os.getenv("VERCEL"):
            raise ImproperlyConfigured(
                "DATABASE_URL is not set. Add a Postgres database to the Vercel project "
                "(Storage -> Postgres/Neon) and expose DATABASE_URL or POSTGRES_URL to "
                "the backend service for all environments."
            )
        DATABASE_URL = "postgres://itpark:itpark_dev_password@127.0.0.1:5434/itpark"
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            # Serverless functions must not keep database connections alive.
            conn_max_age=int(os.getenv("DB_CONN_MAX_AGE", "0" if os.getenv("VERCEL") else "60")),
            conn_health_checks=not bool(os.getenv("VERCEL")),
        )
    }

AUTH_USER_MODEL = "users.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "uz"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", BASE_DIR / "media"))

# Vercel has a read-only, ephemeral filesystem, so production media must live
# in S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, ...).
_STATIC_STORAGE = {
    "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    if not DEBUG
    else "django.contrib.staticfiles.storage.StaticFilesStorage"
}
_S3_BUCKET = os.getenv("AWS_STORAGE_BUCKET_NAME", "").strip()
if _S3_BUCKET:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": _S3_BUCKET,
                "access_key": os.getenv("AWS_S3_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID"),
                "secret_key": os.getenv("AWS_S3_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY"),
                "endpoint_url": os.getenv("AWS_S3_ENDPOINT_URL") or None,
                "region_name": os.getenv("AWS_S3_REGION_NAME") or None,
                "custom_domain": os.getenv("AWS_S3_CUSTOM_DOMAIN") or None,
                "default_acl": None,
                "file_overwrite": False,
                "querystring_auth": env_bool("AWS_QUERYSTRING_AUTH", True),
                "querystring_expire": int(os.getenv("AWS_QUERYSTRING_EXPIRE", "3600")),
                "signature_version": os.getenv("AWS_S3_SIGNATURE_VERSION", "s3v4"),
                "addressing_style": os.getenv("AWS_S3_ADDRESSING_STYLE", "virtual"),
            },
        },
        "staticfiles": _STATIC_STORAGE,
    }
else:
    STORAGES = {
        "default": {
            "BACKEND": os.getenv("DEFAULT_FILE_STORAGE", "django.core.files.storage.FileSystemStorage")
        },
        "staticfiles": _STATIC_STORAGE,
    }

# Presigned video URLs are short-lived because they are handed to the player.
VIDEO_SIGNED_URL_TTL = int(os.getenv("VIDEO_SIGNED_URL_TTL", "900"))
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.users.authentication.CookieAwareJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPagination",
    "PAGE_SIZE": 12,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("THROTTLE_ANON", "120/min"),
        "user": os.getenv("THROTTLE_USER", "600/min"),
        "auth": os.getenv("THROTTLE_AUTH", "15/min"),
        "payment": os.getenv("THROTTLE_PAYMENT", "20/min"),
    },
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("REFRESH_TOKEN_DAYS", "14"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": os.getenv("JWT_SECRET", SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

AUTH_COOKIE_REFRESH = "ipa_refresh"
AUTH_COOKIE_ACCESS = "ipa_access"
AUTH_COOKIE_SECURE = env_bool("AUTH_COOKIE_SECURE", not DEBUG)
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "Lax")
AUTH_COOKIE_PATH = "/api/auth/"

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000",
)
for _host in {VERCEL_URL, VERCEL_PROJECT_PRODUCTION_URL}:
    _origin = f"https://{_host}" if _host else ""
    if _origin and _origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_origin)

# ---------------------------------------------------------------------------
# Integrations
# ---------------------------------------------------------------------------
FRONTEND_URL = os.getenv("FRONTEND_URL", _VERCEL_PUBLIC_URL or "http://localhost:3000")
BACKEND_URL = os.getenv("BACKEND_URL", _VERCEL_PUBLIC_URL or "http://localhost:8000")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "ITParkAcademyBot")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_CREDENTIALS_JSON = os.getenv("FIREBASE_CREDENTIALS_JSON", "")
FIREBASE_CREDENTIALS_FILE = os.getenv("FIREBASE_CREDENTIALS_FILE", "")

PAYMENT_SETTINGS = {
    "CLICK_SERVICE_ID": os.getenv("CLICK_SERVICE_ID", ""),
    "CLICK_MERCHANT_ID": os.getenv("CLICK_MERCHANT_ID", ""),
    "CLICK_SECRET_KEY": os.getenv("CLICK_SECRET_KEY", ""),
    "CLICK_MERCHANT_USER_ID": os.getenv("CLICK_MERCHANT_USER_ID", ""),
    "PAYME_MERCHANT_ID": os.getenv("PAYME_MERCHANT_ID", ""),
    "PAYME_SECRET_KEY": os.getenv("PAYME_SECRET_KEY", ""),
    "UZUM_API_KEY": os.getenv("UZUM_API_KEY", ""),
    "UZUM_SECRET_KEY": os.getenv("UZUM_SECRET_KEY", os.getenv("UZUM_API_KEY", "")),
    "UZUM_MERCHANT_ID": os.getenv("UZUM_MERCHANT_ID", ""),
    "UZUM_SERVICE_ID": os.getenv("UZUM_SERVICE_ID", ""),
    "HUMO_MERCHANT_ID": os.getenv("HUMO_MERCHANT_ID", ""),
    "HUMO_SECRET_KEY": os.getenv("HUMO_SECRET_KEY", ""),
    "HUMO_API_URL": os.getenv("HUMO_API_URL", ""),
    "UZCARD_MERCHANT_ID": os.getenv("UZCARD_MERCHANT_ID", ""),
    "UZCARD_SECRET_KEY": os.getenv("UZCARD_SECRET_KEY", ""),
    "UZCARD_API_URL": os.getenv("UZCARD_API_URL", ""),
    "GOOGLE_PAY_MERCHANT_ID": os.getenv("GOOGLE_PAY_MERCHANT_ID", ""),
    "GOOGLE_PAY_GATEWAY": os.getenv("GOOGLE_PAY_GATEWAY", ""),
    "GOOGLE_PAY_GATEWAY_MERCHANT_ID": os.getenv("GOOGLE_PAY_GATEWAY_MERCHANT_ID", ""),
    "APPLE_PAY_MERCHANT_ID": os.getenv("APPLE_PAY_MERCHANT_ID", ""),
    "APPLE_PAY_CERTIFICATE": os.getenv("APPLE_PAY_CERTIFICATE", ""),
    "CLICK_CHECKOUT_URL": os.getenv("CLICK_CHECKOUT_URL", "https://my.click.uz/services/pay"),
    "PAYME_CHECKOUT_URL": os.getenv("PAYME_CHECKOUT_URL", "https://checkout.paycom.uz"),
    "UZUM_CHECKOUT_URL": os.getenv("UZUM_CHECKOUT_URL", "https://checkout.uzumbank.uz"),
}

SUBSCRIPTION_GRACE_DAYS = int(os.getenv("SUBSCRIPTION_GRACE_DAYS", "3"))
SUBSCRIPTION_PERIOD_DAYS = int(os.getenv("SUBSCRIPTION_PERIOD_DAYS", "30"))
CERTIFICATE_PASS_SCORE = int(os.getenv("CERTIFICATE_PASS_SCORE", "7"))
QUIZ_QUESTIONS_PER_QUIZ = int(os.getenv("QUIZ_QUESTIONS_PER_QUIZ", "10"))
SINGLE_TEACHER_ENFORCED = env_bool("SINGLE_TEACHER_ENFORCED", True)

# ---------------------------------------------------------------------------
# Celery / Redis
# ---------------------------------------------------------------------------
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
# Vercel runs no Celery worker or beat scheduler, so queue-triggered work runs inline.
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", DEBUG or bool(os.getenv("VERCEL")))
CELERY_TASK_EAGER_PROPAGATES = DEBUG
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    "expire-subscriptions-hourly": {
        "task": "apps.subscriptions.tasks.sync_subscription_statuses",
        "schedule": 3600.0,
    },
    "subscription-reminders-daily": {
        "task": "apps.subscriptions.tasks.send_subscription_reminders",
        "schedule": 86400.0,
    },
    "rebuild-daily-analytics": {
        "task": "apps.analytics.tasks.rebuild_daily_analytics",
        "schedule": 3600.0,
    },
}

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "IT PARK ACADEMY <noreply@itparkacademy.uz>")

SPECTACULAR_SETTINGS = {
    "TITLE": "IT PARK ACADEMY API",
    "DESCRIPTION": "Production LMS API: auth, courses, protected video, quizzes, subscriptions, payments, certificates, notifications and analytics.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SECURITY": [{"jwtAuth": []}],
}

# ---------------------------------------------------------------------------
# Security hardening (enabled outside DEBUG)
# ---------------------------------------------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", not DEBUG)
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("DATA_UPLOAD_MAX_MEMORY_SIZE", str(20 * 1024 * 1024)))
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("FILE_UPLOAD_MAX_MEMORY_SIZE", str(20 * 1024 * 1024)))

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "{levelname} {asctime} {name} {message}", "style": "{"},
        "simple": {"format": "{levelname} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
    "loggers": {
        "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps": {"handlers": ["console"], "level": os.getenv("APP_LOG_LEVEL", "INFO"), "propagate": False},
    },
}
