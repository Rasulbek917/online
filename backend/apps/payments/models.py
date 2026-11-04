import hashlib
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import TimeStampedModel


class Payment(TimeStampedModel):
    class Provider(models.TextChoices):
        CLICK = "click", "Click"
        PAYME = "payme", "Payme"
        UZUM = "uzum", "Uzum Bank"
        HUMO = "humo", "HUMO"
        UZCARD = "uzcard", "UZCARD"
        GOOGLE_PAY = "google_pay", "Google Pay"
        APPLE_PAY = "apple_pay", "Apple Pay"
        SANDBOX = "sandbox", "Sandbox (development)"
        MANUAL = "manual", "Manual / bank transfer"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"
        REFUNDED = "refunded", "Refunded"

    class BillingPeriod(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        FULL = "full", "Full course"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments"
    )
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="payments")
    subscription = models.ForeignKey(
        "subscriptions.Subscription",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )
    provider = models.CharField(max_length=16, choices=Provider.choices, db_index=True)
    billing_period = models.CharField(
        max_length=10, choices=BillingPeriod.choices, default=BillingPeriod.MONTHLY
    )
    amount = models.DecimalField(max_digits=12, decimal_places=0)
    currency = models.CharField(max_length=3, default="UZS")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    provider_transaction_id = models.CharField(max_length=128, unique=True, blank=True, null=True)
    order_id = models.CharField(max_length=128, blank=True)
    transaction_id = models.CharField(max_length=128, blank=True)
    provider_state = models.IntegerField(default=0)
    idempotency_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    checkout_url = models.URLField(max_length=1000, blank=True)
    provider_payload = models.JSONField(default=dict, blank=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    refund_reason = models.CharField(max_length=255, blank=True)
    refunded_at = models.DateTimeField(blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["course", "status"]),
            models.Index(fields=["provider", "status"]),
            models.Index(fields=["created_at", "status"]),
        ]

    def __str__(self):
        return f"{self.provider} {self.amount} {self.currency} [{self.status}]"

    @property
    def is_final(self):
        return self.status in {
            self.Status.SUCCESS,
            self.Status.FAILED,
            self.Status.CANCELED,
            self.Status.REFUNDED,
        }


class PaymentWebhookLog(TimeStampedModel):
    provider = models.CharField(max_length=16, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    headers = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    verified = models.BooleanField(default=False)
    processed = models.BooleanField(default=False)
    error = models.CharField(max_length=255, blank=True)
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class PaymentCallback(TimeStampedModel):
    provider = models.CharField(max_length=16, db_index=True)
    external_transaction_id = models.CharField(max_length=128, blank=True)
    payload_hash = models.CharField(max_length=64, db_index=True)
    processed = models.BooleanField(default=False)
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True)
    received_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "payload_hash"],
                name="unique_payment_callback_payload_hash",
            )
        ]

    @staticmethod
    def hash_payload(payload):
        if isinstance(payload, dict):
            import json

            data = json.dumps(payload, sort_keys=True, ensure_ascii=True)
        else:
            data = str(payload)
        return hashlib.sha256(data.encode("utf-8")).hexdigest()


class PaymentAuditLog(TimeStampedModel):
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="audit_logs")
    action = models.CharField(max_length=40)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
