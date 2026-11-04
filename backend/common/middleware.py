import logging

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from common.utils import get_client_ip

logger = logging.getLogger(__name__)

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SKIPPED_PATHS = ("/api/auth/refresh/", "/api/auth/logout/", "/api/auth/login/")


class AdminAuditMiddleware:
    """Record every successful state-changing API call made by an admin."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._maybe_record(request, response)
        except Exception:
            logger.exception("Failed to write admin audit log")
        return response

    def _maybe_record(self, request, response):
        if request.method not in UNSAFE_METHODS:
            return
        if not request.path.startswith("/api/"):
            return
        if request.path in SKIPPED_PATHS:
            return
        if not 200 <= response.status_code < 300:
            return

        user = self._resolve_user(request)
        if user is None or user.role != "admin":
            return

        from apps.analytics.models import AuditLog

        segments = [part for part in request.path.strip("/").split("/") if part]
        model_name = segments[1] if len(segments) > 1 else ""
        object_id = ""
        if len(segments) >= 3 and segments[2] not in {
            "mine",
            "students",
            "broadcast",
            "settings",
            "analytics",
        }:
            object_id = segments[2][:64]

        AuditLog.objects.create(
            user=user,
            action=f"{request.method} {request.path}"[:80],
            model_name=model_name[:80],
            object_id=object_id,
            ip_address=get_client_ip(request),
            metadata={
                "method": request.method,
                "path": request.path,
                "status": response.status_code,
            },
        )

    def _resolve_user(self, request):
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return user

        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.lower().startswith("bearer "):
            return None

        from apps.users.models import User

        try:
            token = AccessToken(header.split(" ", 1)[1].strip())
        except TokenError:
            return None
        return User.objects.filter(id=token.get("user_id"), is_active=True).first()
