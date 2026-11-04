import logging

import requests
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from common.utils import hash_token
from .models import EmailVerificationToken, PasswordResetToken, Profile, User

logger = logging.getLogger("apps.users")


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            "bio",
            "headline",
            "language",
            "theme",
            "telegram_username",
            "website",
            "country",
            "city",
        ]


class UserMeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    profile = ProfileSerializer(read_only=True)
    points = serializers.IntegerField(source="points_balance.points", read_only=True, default=0)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "role",
            "avatar",
            "is_email_verified",
            "profile",
            "points",
            "created_at",
        ]

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url


class UserPublicSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "full_name", "avatar", "role"]

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url


class UserAdminSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    courses_count = serializers.IntegerField(read_only=True, default=0)
    enrollments_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "role",
            "is_active",
            "is_email_verified",
            "is_staff",
            "courses_count",
            "enrollments_count",
            "last_login",
            "created_at",
        ]
        read_only_fields = ["is_staff", "last_login", "created_at"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=80)
    last_name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    language = serializers.ChoiceField(choices=["uz", "ru"], default="uz")
    accept_terms = serializers.BooleanField()

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        if not attrs.get("accept_terms"):
            raise serializers.ValidationError({"accept_terms": "You must accept the terms of service."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        language = validated_data.pop("language", "uz")
        validated_data.pop("accept_terms", None)
        user = User.objects.create_user(**validated_data)
        user.profile.language = language
        user.profile.save(update_fields=["language"])
        send_verification_email(user)
        return user


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        token["name"] = user.full_name
        token["email_verified"] = user.is_email_verified
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserMeSerializer(self.user, context=self.context).data
        return data


class GoogleAuthSerializer(serializers.Serializer):
    credential = serializers.CharField()

    def validate_credential(self, value):
        if not settings.GOOGLE_CLIENT_ID:
            raise serializers.ValidationError("Google sign-in is not configured on this server.")
        try:
            response = requests.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": value},
                timeout=8,
            )
        except requests.RequestException as exc:
            logger.warning("Google token verification failed: %s", exc)
            raise serializers.ValidationError("Could not verify Google account. Try again.")
        if response.status_code != 200:
            raise serializers.ValidationError("Invalid Google credential.")
        payload = response.json()
        if payload.get("aud") != settings.GOOGLE_CLIENT_ID:
            raise serializers.ValidationError("Google credential was issued for another application.")
        if payload.get("email_verified") not in (True, "true", "True"):
            raise serializers.ValidationError("Google email is not verified.")
        if not payload.get("email"):
            raise serializers.ValidationError("Google account has no email.")
        return payload


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(validators=[validate_password])
    password_confirm = serializers.CharField()

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        token = PasswordResetToken.objects.filter(
            token_hash=hash_token(attrs["token"]), used_at__isnull=True
        ).select_related("user").first()
        if not token or not token.is_valid:
            raise serializers.ValidationError({"token": "This reset link is invalid or has expired."})
        attrs["reset_token"] = token
        return attrs


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField()

    def validate_token(self, value):
        token = EmailVerificationToken.objects.filter(
            token_hash=hash_token(value), used_at__isnull=True
        ).select_related("user").first()
        if not token or not token.is_valid:
            raise serializers.ValidationError("This verification link is invalid or has expired.")
        return token


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    new_password_confirm = serializers.CharField()

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs.pop("new_password_confirm"):
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        return attrs


def send_verification_email(user):
    raw = EmailVerificationToken.issue(user)
    link = f"{settings.FRONTEND_URL}/verify-email?token={raw}"
    try:
        send_mail(
            "IT PARK ACADEMY — Email manzilingizni tasdiqlang",
            f"Salom {user.full_name}!\n\nEmail manzilingizni tasdiqlash uchun havola:\n{link}\n\nHavola 24 soat amal qiladi.",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception("Could not send verification email to %s", user.email)
    return raw


def send_password_reset_email(user):
    raw = PasswordResetToken.issue(user)
    link = f"{settings.FRONTEND_URL}/reset-password?token={raw}"
    try:
        send_mail(
            "IT PARK ACADEMY — Parolni tiklash",
            f"Parolni tiklash uchun havola:\n{link}\n\nHavola 1 soat amal qiladi. Agar siz so'rov yubormagan bo'lsangiz, xabarni e'tiborsiz qoldiring.",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception("Could not send password reset email to %s", user.email)
    return raw


def issue_tokens_for_user(user, request=None, context=None, status_code=None):
    """Create a JWT pair for verified passwordless login flows (Google)."""
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    refresh["email"] = user.email
    refresh["name"] = user.full_name
    refresh["email_verified"] = user.is_email_verified
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserMeSerializer(user, context=context or {}).data,
    }
