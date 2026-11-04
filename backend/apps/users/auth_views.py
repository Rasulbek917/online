import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from common.utils import get_client_ip
from .models import PasswordResetToken, User
from .serializers import (
    ChangePasswordSerializer,
    GoogleAuthSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserMeSerializer,
    VerifyEmailSerializer,
    issue_tokens_for_user,
    send_password_reset_email,
    send_verification_email,
)

logger = logging.getLogger("apps.users")


def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        key=settings.AUTH_COOKIE_REFRESH,
        value=refresh_token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path=settings.AUTH_COOKIE_PATH,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(
        settings.AUTH_COOKIE_REFRESH,
        path=settings.AUTH_COOKIE_PATH,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        data = issue_tokens_for_user(user, context={"request": request})
        payload = {
            "access": data["access"],
            "user": data["user"],
            "message": "Account created. Please verify your email address.",
        }
        if request.data.get("client") == "mobile":
            payload["refresh"] = data["refresh"]
        response = Response(payload, status=status.HTTP_201_CREATED)
        return set_refresh_cookie(response, data["refresh"])


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        user.last_login = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=["last_login", "last_login_ip"])
        if user.role == User.Role.ADMIN:
            from apps.analytics.models import AuditLog

            AuditLog.objects.create(
                user=user,
                action="auth.login",
                model_name="user",
                object_id=str(user.id),
                ip_address=get_client_ip(request),
                metadata={"email": user.email},
            )
        payload = {
            "access": serializer.validated_data["access"],
            "user": serializer.validated_data["user"],
        }
        if request.data.get("client") == "mobile":
            payload["refresh"] = serializer.validated_data["refresh"]
        response = Response(payload)
        return set_refresh_cookie(response, serializer.validated_data["refresh"])


class RefreshView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH) or request.data.get("refresh")
        if not raw:
            return Response(
                {"error": {"code": "unauthorized", "message": "Refresh token not provided."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = TokenRefreshSerializer(data={"refresh": raw})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return Response(
                {"error": {"code": "invalid_refresh", "message": "Session expired. Please sign in again."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        data = serializer.validated_data
        new_refresh = data.get("refresh", raw)
        payload = {"access": data["access"]}
        if request.data.get("refresh"):
            payload["refresh"] = new_refresh
        response = Response(payload)
        return set_refresh_cookie(response, new_refresh)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH) or request.data.get("refresh")
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        response = Response({"detail": "Signed out."})
        return clear_refresh_cookie(response)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserMeSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        user = request.user
        allowed = {"first_name", "last_name", "phone"}
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field])
        if "language" in request.data:
            language = request.data["language"]
            if language in {"uz", "ru"}:
                user.profile.language = language
        if "theme" in request.data:
            theme = request.data["theme"]
            if theme in {"dark", "light", "system"}:
                user.profile.theme = theme
        for field in {"bio", "headline", "telegram_username", "website", "city", "country"}:
            if field in request.data:
                setattr(user.profile, field, request.data[field])
        if "avatar" in request.FILES:
            user.avatar = request.FILES["avatar"]
        user.save()
        user.profile.save()
        return Response(UserMeSerializer(user, context={"request": request}).data)


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @transaction.atomic
    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data["credential"]
        email = payload["email"].lower()
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create_user(
                email=email,
                password=None,
                first_name=payload.get("given_name", ""),
                last_name=payload.get("family_name", ""),
                is_email_verified=True,
                email_verified_at=timezone.now(),
                google_sub=payload.get("sub"),
            )
            user.set_unusable_password()
            user.save(update_fields=["password"])
        else:
            changed = []
            if not user.google_sub and payload.get("sub"):
                user.google_sub = payload["sub"]
                changed.append("google_sub")
            if not user.is_email_verified:
                user.is_email_verified = True
                user.email_verified_at = timezone.now()
                changed.extend(["is_email_verified", "email_verified_at"])
            if changed:
                user.save(update_fields=changed)
        if not user.is_active:
            return Response(
                {"error": {"code": "account_disabled", "message": "This account is disabled."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        data = issue_tokens_for_user(user, context={"request": request})
        response = Response(
            {"access": data["access"], "user": data["user"], "message": "Signed in with Google."}
        )
        return set_refresh_cookie(response, data["refresh"])


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        user = token.user
        token.used_at = timezone.now()
        token.save(update_fields=["used_at"])
        if not user.is_email_verified:
            user.is_email_verified = True
            user.email_verified_at = timezone.now()
            user.save(update_fields=["is_email_verified", "email_verified_at"])
        return Response({"detail": "Email verified successfully."})


class ResendVerificationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        if request.user.is_email_verified:
            return Response({"detail": "Email is already verified."})
        send_verification_email(request.user)
        return Response({"detail": "Verification email sent."})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email=serializer.validated_data["email"].lower(), is_active=True).first()
        if user:
            send_password_reset_email(user)
        return Response({"detail": "If the account exists, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @transaction.atomic
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["reset_token"]
        user = token.user
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        token.used_at = timezone.now()
        token.save(update_fields=["used_at"])
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)
        return Response({"detail": "Password updated. Please sign in."})


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password changed successfully."})


class TelegramAuthInitView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        bot_username = getattr(settings, "TELEGRAM_BOT_USERNAME", "")
        if not bot_username:
            return Response(
                {"error": {"code": "not_configured", "message": "Telegram login is not configured."}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"bot_username": bot_username, "url": f"https://t.me/{bot_username}"})


class TelegramAuthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @transaction.atomic
    def post(self, request):
        token = (request.data.get("token") or "").strip()
        if not token:
            return Response(
                {"error": {"code": "validation_error", "message": "Telegram token is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.notifications.models import TelegramAccount

        account = (
            TelegramAccount.objects.filter(login_token=token)
            .select_related("user")
            .first()
        )
        if not account or not account.is_linked or not account.chat_id:
            return Response(
                {"error": {"code": "invalid_token", "message": "Invalid or unlinked Telegram login token."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not account.login_token_expires_at or account.login_token_expires_at < timezone.now():
            return Response(
                {"error": {"code": "expired_token", "message": "Telegram login token has expired."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if account.login_token_used_at:
            return Response(
                {"error": {"code": "used_token", "message": "Telegram login token has already been used."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = account.user
        if not user.is_active:
            return Response(
                {"error": {"code": "inactive", "message": "This account is disabled."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.last_login = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=["last_login", "last_login_ip"])
        account.login_token_used_at = timezone.now()
        account.save(update_fields=["login_token_used_at", "updated_at"])
        data = issue_tokens_for_user(user, context={"request": request})
        payload = {
            "access": data["access"],
            "user": data["user"],
            "message": "Signed in with Telegram.",
        }
        if request.data.get("client") == "mobile":
            payload["refresh"] = data["refresh"]
        response = Response(payload)
        return set_refresh_cookie(response, data["refresh"])
