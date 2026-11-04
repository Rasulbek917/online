import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from common.models import TimeStampedModel
from common.utils import hash_token


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", User.Role.STUDENT)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        extra_fields.setdefault("is_email_verified", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    class Role(models.TextChoices):
        STUDENT = "student", _("Student")
        TEACHER = "teacher", _("Teacher")
        ADMIN = "admin", _("Administrator")

    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=80, blank=True)
    last_name = models.CharField(max_length=80, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STUDENT, db_index=True)
    avatar = models.ImageField(upload_to="avatars/%Y/%m/", blank=True, null=True)
    google_sub = models.CharField(max_length=128, unique=True, blank=True, null=True)
    is_email_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    last_login_ip = models.GenericIPAddressField(blank=True, null=True)
    last_login = models.DateTimeField(blank=True, null=True)
    email_verified_at = models.DateTimeField(blank=True, null=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["role", "is_active"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return self.email

    def clean(self):
        super().clean()
        if (
            self.role == self.Role.TEACHER
            and settings.SINGLE_TEACHER_ENFORCED
            and not self.is_superuser
        ):
            qs = User.objects.filter(role=self.Role.TEACHER, is_active=True)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError(_("Only one teacher account is allowed on this platform."))

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email.split("@")[0]

    @property
    def is_student(self):
        return self.role == self.Role.STUDENT

    @property
    def is_teacher(self):
        return self.role == self.Role.TEACHER

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN or self.is_superuser


def avatar_upload_to(instance, filename):
    return f"avatars/{instance.user_id}/{filename}"


class Profile(TimeStampedModel):
    class Theme(models.TextChoices):
        DARK = "dark", "Dark"
        LIGHT = "light", "Light"
        SYSTEM = "system", "System"

    class Language(models.TextChoices):
        UZ = "uz", "O'zbekcha"
        RU = "ru", "Русский"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bio = models.TextField(blank=True, max_length=1000)
    headline = models.CharField(max_length=160, blank=True)
    language = models.CharField(max_length=5, choices=Language.choices, default=Language.UZ)
    theme = models.CharField(max_length=10, choices=Theme.choices, default=Theme.DARK)
    telegram_username = models.CharField(max_length=64, blank=True)
    website = models.URLField(blank=True)
    country = models.CharField(max_length=80, blank=True, default="Uzbekistan")
    city = models.CharField(max_length=80, blank=True)

    def __str__(self):
        return f"Profile of {self.user.email}"


class EmailVerificationToken(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)

    @classmethod
    def issue(cls, user):
        cls.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
        raw = secrets.token_urlsafe(40)
        cls.objects.create(
            user=user,
            token_hash=hash_token(raw),
            expires_at=timezone.now() + timedelta(hours=24),
        )
        return raw

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()

    def __str__(self):
        return f"Email token for {self.user_id}"


class PasswordResetToken(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)

    @classmethod
    def issue(cls, user):
        cls.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
        raw = secrets.token_urlsafe(40)
        cls.objects.create(
            user=user,
            token_hash=hash_token(raw),
            expires_at=timezone.now() + timedelta(hours=1),
        )
        return raw

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()
