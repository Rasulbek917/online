from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import TimeStampedModel


class Subscription(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        GRACE = "grace", "Grace period"
        EXPIRED = "expired", "Expired"
        CANCELED = "canceled", "Canceled"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscriptions"
    )
    course = models.ForeignKey(
        "courses.Course", on_delete=models.CASCADE, related_name="subscriptions"
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    started_at = models.DateTimeField(default=timezone.now)
    current_period_start = models.DateTimeField(default=timezone.now)
    current_period_end = models.DateTimeField(db_index=True)
    grace_until = models.DateTimeField(db_index=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    expiry_notified_at = models.DateTimeField(null=True, blank=True)
    grace_notified_at = models.DateTimeField(null=True, blank=True)
    closed_notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-current_period_end"]
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="unique_subscription_per_user_course")
        ]
        indexes = [models.Index(fields=["status", "grace_until"])]

    def __str__(self):
        return f"{self.user} / {self.course} until {self.current_period_end:%Y-%m-%d}"

    @property
    def access_until(self):
        return self.grace_until

    @property
    def is_access_active(self):
        return self.status in {self.Status.ACTIVE, self.Status.GRACE} and timezone.now() <= self.grace_until

    @property
    def days_remaining(self):
        delta = self.grace_until - timezone.now()
        return max(0, delta.days)

    @property
    def in_grace(self):
        now = timezone.now()
        return self.status == self.Status.GRACE or (
            self.current_period_end < now <= self.grace_until
        )

    def refresh_status(self, save=True):
        now = timezone.now()
        old = self.status
        if self.status == self.Status.CANCELED:
            new = self.Status.CANCELED
        elif now <= self.current_period_end:
            new = self.Status.ACTIVE
        elif now <= self.grace_until:
            new = self.Status.GRACE
        else:
            new = self.Status.EXPIRED
        self.status = new
        if save and new != old:
            self.save(update_fields=["status", "updated_at"])
        return new


def _billing_config():
    try:
        from apps.analytics.models import SystemSettings

        config = SystemSettings.load()
        return (
            config.subscription_period_days or settings.SUBSCRIPTION_PERIOD_DAYS,
            config.grace_period_days if config.grace_period_days is not None else settings.SUBSCRIPTION_GRACE_DAYS,
        )
    except Exception:
        return settings.SUBSCRIPTION_PERIOD_DAYS, settings.SUBSCRIPTION_GRACE_DAYS


def get_subscription(user, course):
    if not user or not user.is_authenticated:
        return None
    return Subscription.objects.filter(user=user, course=course).first()


def active_subscription(user, course):
    subscription = get_subscription(user, course)
    if not subscription:
        return None
    if subscription.refresh_status() in {Subscription.Status.ACTIVE, Subscription.Status.GRACE}:
        return subscription
    return None


def activate_subscription(user, course, period_days=None):
    """Create or renew a monthly subscription. Idempotent for the current period."""
    default_period, grace_days = _billing_config()
    period_days = period_days or default_period
    now = timezone.now()
    subscription, created = Subscription.objects.select_for_update().get_or_create(
        user=user,
        course=course,
        defaults={
            "started_at": now,
            "current_period_start": now,
            "current_period_end": now + timedelta(days=period_days),
            "grace_until": now + timedelta(days=period_days + grace_days),
            "status": Subscription.Status.ACTIVE,
        },
    )
    if not created:
        if subscription.current_period_end > now:
            start = subscription.current_period_end
        else:
            start = now
        subscription.current_period_start = start
        subscription.current_period_end = start + timedelta(days=period_days)
        subscription.grace_until = subscription.current_period_end + timedelta(days=grace_days)
        subscription.status = Subscription.Status.ACTIVE
        subscription.canceled_at = None
        subscription.expiry_notified_at = None
        subscription.grace_notified_at = None
        subscription.closed_notified_at = None
        subscription.save()

    from apps.courses.services import get_or_create_enrollment

    get_or_create_enrollment(user, course)
    return subscription
