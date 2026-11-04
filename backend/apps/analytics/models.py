from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import TimeStampedModel


class StudentPoints(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="points_balance"
    )
    points = models.IntegerField(default=0, db_index=True)

    def __str__(self):
        return f"{self.user_id}: {self.points}"


class PointsTransaction(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="points_transactions"
    )
    points = models.IntegerField()
    reason = models.CharField(max_length=64, db_index=True)
    reference = models.CharField(max_length=128, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "reference"],
                condition=models.Q(reference__gt=""),
                name="unique_points_reference_per_user",
            )
        ]
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self):
        return f"{self.user_id} {self.points:+d} ({self.reason})"


class Leaderboard(TimeStampedModel):
    class Period(models.TextChoices):
        ALL = "all", "All time"
        MONTH = "month", "This month"
        WEEK = "week", "This week"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="leaderboard_entries"
    )
    period = models.CharField(max_length=8, choices=Period.choices, default=Period.ALL)
    points = models.IntegerField(default=0)
    completed_courses = models.PositiveIntegerField(default=0)
    quiz_accuracy = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    rank = models.PositiveIntegerField(default=0, db_index=True)
    calculated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["rank"]
        constraints = [
            models.UniqueConstraint(fields=["user", "period"], name="unique_leaderboard_entry")
        ]

    def __str__(self):
        return f"{self.period} #{self.rank} {self.user_id}"


class ActivityEvent(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="activity_events",
        null=True,
        blank=True,
    )
    event = models.CharField(max_length=64, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["event", "created_at"])]


class DailyAnalytics(models.Model):
    date = models.DateField(unique=True, db_index=True)
    revenue = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    new_students = models.PositiveIntegerField(default=0)
    active_subscriptions = models.PositiveIntegerField(default=0)
    enrollments = models.PositiveIntegerField(default=0)
    completions = models.PositiveIntegerField(default=0)
    quiz_attempts = models.PositiveIntegerField(default=0)
    quiz_passes = models.PositiveIntegerField(default=0)
    new_certificates = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]
        verbose_name_plural = "Daily analytics"

    def __str__(self):
        return f"Analytics {self.date}"


class SystemSettings(TimeStampedModel):
    site_name = models.CharField(max_length=120, default="IT PARK ACADEMY")
    support_email = models.EmailField(default="support@itparkacademy.uz")
    support_phone = models.CharField(max_length=32, default="+998 71 200 00 00")
    telegram_url = models.URLField(default="https://t.me/itparkacademy")
    instagram_url = models.URLField(default="https://instagram.com/itparkacademy")
    youtube_url = models.URLField(default="https://youtube.com/@itparkacademy")
    default_language = models.CharField(max_length=2, default="uz")
    grace_period_days = models.PositiveSmallIntegerField(default=3)
    subscription_period_days = models.PositiveSmallIntegerField(default=30)
    quiz_passing_score = models.PositiveSmallIntegerField(default=7)
    certificate_enabled = models.BooleanField(default=True)
    maintenance_mode = models.BooleanField(default=False)
    click_enabled = models.BooleanField(default=True)
    payme_enabled = models.BooleanField(default=True)
    uzum_enabled = models.BooleanField(default=True)
    humo_enabled = models.BooleanField(default=True)
    uzcard_enabled = models.BooleanField(default=True)
    google_pay_enabled = models.BooleanField(default=True)
    apple_pay_enabled = models.BooleanField(default=True)
    announcement = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "System settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.site_name


class Testimonial(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="testimonials",
    )
    course = models.ForeignKey(
        "courses.Course", on_delete=models.SET_NULL, null=True, blank=True, related_name="testimonials"
    )
    name = models.CharField(max_length=120)
    role_uz = models.CharField(max_length=120, blank=True, default="Bitiruvchi")
    role_ru = models.CharField(max_length=120, blank=True, default="Выпускник")
    quote_uz = models.TextField()
    quote_ru = models.TextField()
    rating = models.PositiveSmallIntegerField(default=5)
    avatar = models.ImageField(upload_to="testimonials/%Y/%m/", blank=True, null=True)
    is_approved = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "-created_at"]

    def __str__(self):
        return self.name


class AuditLog(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    action = models.CharField(max_length=80, db_index=True)
    model_name = models.CharField(max_length=80, blank=True)
    object_id = models.CharField(max_length=64, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["action", "created_at"])]

    def __str__(self):
        return f"{self.action} by {self.user_id}"
