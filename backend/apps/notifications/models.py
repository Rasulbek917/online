import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import TimeStampedModel


class Notification(TimeStampedModel):
    class Type(models.TextChoices):
        REGISTRATION = "registration", "Registration"
        COURSE_PURCHASE = "course_purchase", "Course purchase"
        PAYMENT_SUCCESS = "payment_success", "Payment success"
        PAYMENT_FAILED = "payment_failed", "Payment failed"
        SUBSCRIPTION_EXPIRING = "subscription_expiring", "Subscription expiring"
        SUBSCRIPTION_GRACE = "subscription_grace", "Grace period"
        SUBSCRIPTION_EXPIRED = "subscription_expired", "Subscription expired"
        COURSE_ACCESS_CLOSED = "course_access_closed", "Course access closed"
        NEW_LESSON = "new_lesson", "New lesson"
        QUIZ_RESULT = "quiz_result", "Quiz result"
        CERTIFICATE_READY = "certificate_ready", "Certificate ready"
        DISCOUNT = "discount", "Discount"
        NEW_COURSE = "new_course", "New course"
        COMMENT = "comment", "Comment"
        SYSTEM = "system", "System"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=32, choices=Type.choices, default=Type.SYSTEM, db_index=True)
    title_uz = models.CharField(max_length=180)
    title_ru = models.CharField(max_length=180)
    message_uz = models.TextField()
    message_ru = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "is_read", "created_at"])]

    def __str__(self):
        return f"{self.user_id}: {self.title_uz}"


class Broadcast(TimeStampedModel):
    class Audience(models.TextChoices):
        ALL = "all", "All users"
        STUDENTS = "students", "Students"
        COURSE = "course", "Course students"

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="broadcasts",
    )
    type = models.CharField(max_length=32, choices=Notification.Type.choices, default=Notification.Type.SYSTEM)
    audience = models.CharField(max_length=16, choices=Audience.choices, default=Audience.STUDENTS)
    course_slug = models.CharField(max_length=160, blank=True)
    title_uz = models.CharField(max_length=180)
    title_ru = models.CharField(max_length=180)
    message_uz = models.TextField()
    message_ru = models.TextField()
    recipients_count = models.PositiveIntegerField(default=0)
    telegram = models.BooleanField(default=False)
    push = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title_uz} ({self.recipients_count})"


class TelegramAccount(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="telegram_account"
    )
    chat_id = models.BigIntegerField(unique=True, null=True, blank=True)
    username = models.CharField(max_length=64, blank=True)
    link_token = models.CharField(max_length=64, unique=True, default="")
    login_token = models.CharField(max_length=64, blank=True, db_index=True)
    login_token_expires_at = models.DateTimeField(null=True, blank=True)
    login_token_used_at = models.DateTimeField(null=True, blank=True)
    linked_at = models.DateTimeField(null=True, blank=True)
    notifications_enabled = models.BooleanField(default=True)

    def __str__(self):
        return f"Telegram {self.user_id}"

    @property
    def is_linked(self):
        return bool(self.chat_id and self.linked_at)

    def issue_link_token(self):
        self.link_token = secrets.token_urlsafe(24)
        self.save(update_fields=["link_token", "updated_at"])
        return self.link_token

    def issue_login_token(self, minutes=5):
        from django.utils import timezone
        from datetime import timedelta

        self.login_token = secrets.token_urlsafe(32)
        self.login_token_expires_at = timezone.now() + timedelta(minutes=minutes)
        self.login_token_used_at = None
        self.save(update_fields=["login_token", "login_token_expires_at", "login_token_used_at", "updated_at"])
        return self.login_token

    @property
    def deep_link(self):
        return f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={self.link_token or ''}"

    @property
    def login_deep_link(self):
        if not self.login_token:
            return ""
        return f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start=login_{self.login_token}"


class PushDevice(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_devices"
    )
    token = models.CharField(max_length=512, unique=True)
    platform = models.CharField(
        max_length=12, choices=[("android", "Android"), ("ios", "iOS"), ("web", "Web")], default="android"
    )
    device_name = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    last_seen_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-last_seen_at"]

    def __str__(self):
        return f"{self.platform} device for {self.user_id}"
