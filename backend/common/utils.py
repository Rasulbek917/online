import hashlib
import secrets
import string
import uuid

from django.utils import timezone
from django.utils.text import slugify


def get_client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_token(length: int = 48) -> str:
    return secrets.token_urlsafe(length)[:length]


def generate_certificate_id() -> str:
    year = timezone.now().year
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(8))
    return f"IPA-{year}-{suffix}"


def unique_slug(instance, value: str, field: str = "slug") -> str:
    base = slugify(value)[:200] or uuid.uuid4().hex[:8]
    candidate = base
    model = instance.__class__
    counter = 2
    while model.objects.filter(**{field: candidate}).exclude(pk=instance.pk).exists():
        candidate = f"{base}-{counter}"
        counter += 1
    return candidate


def money(value) -> str:
    return f"{value:,.0f}".replace(",", " ")
