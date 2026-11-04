import base64
import hashlib
import logging
import os
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.courses.models import Course
from apps.courses.services import get_or_create_enrollment
from apps.subscriptions.models import Subscription, activate_subscription
from .models import Payment, PaymentAuditLog

logger = logging.getLogger("apps.payments")

PAYMENT_SETTINGS = settings.PAYMENT_SETTINGS


def provider_configured(provider: str) -> bool:
    if provider == Payment.Provider.CLICK:
        return bool(
            PAYMENT_SETTINGS["CLICK_SERVICE_ID"]
            and PAYMENT_SETTINGS["CLICK_MERCHANT_ID"]
            and PAYMENT_SETTINGS["CLICK_SECRET_KEY"]
        )
    if provider == Payment.Provider.PAYME:
        return bool(PAYMENT_SETTINGS["PAYME_MERCHANT_ID"] and PAYMENT_SETTINGS["PAYME_SECRET_KEY"])
    if provider == Payment.Provider.UZUM:
        return bool(
            (PAYMENT_SETTINGS.get("UZUM_API_KEY") or PAYMENT_SETTINGS.get("UZUM_SECRET_KEY"))
            and PAYMENT_SETTINGS.get("UZUM_MERCHANT_ID")
        )
    if provider == Payment.Provider.HUMO:
        return bool(PAYMENT_SETTINGS.get("HUMO_MERCHANT_ID") and PAYMENT_SETTINGS.get("HUMO_SECRET_KEY"))
    if provider == Payment.Provider.UZCARD:
        return bool(PAYMENT_SETTINGS.get("UZCARD_MERCHANT_ID") and PAYMENT_SETTINGS.get("UZCARD_SECRET_KEY"))
    if provider == Payment.Provider.GOOGLE_PAY:
        return bool(PAYMENT_SETTINGS.get("GOOGLE_PAY_MERCHANT_ID") or PAYMENT_SETTINGS.get("GOOGLE_PAY_GATEWAY_MERCHANT_ID"))
    if provider == Payment.Provider.APPLE_PAY:
        return bool(PAYMENT_SETTINGS.get("APPLE_PAY_MERCHANT_ID"))
    if provider == Payment.Provider.SANDBOX:
        return settings.DEBUG and os.getenv("PAYMENT_SANDBOX_ENABLED", "true").lower() in {"1", "true", "yes"}
    return provider == Payment.Provider.MANUAL


def enabled_providers():
    return [
        {"id": provider, "label": label, "enabled": provider_configured(provider)}
        for provider, label in Payment.Provider.choices
        if provider != Payment.Provider.MANUAL
    ]


def calculate_amount(course: Course, billing_period: str) -> Decimal:
    if course.is_free:
        raise ValidationError("Free courses do not require payment.")
    if billing_period == Payment.BillingPeriod.FULL:
        amount = course.effective_price
    else:
        amount = course.effective_monthly_price
    if amount <= 0:
        raise ValidationError("This course has no payable price configured.")
    return amount


def build_checkout_url(payment: Payment) -> str:
    cfg = PAYMENT_SETTINGS
    base_return = f"{settings.FRONTEND_URL}/dashboard/payments"
    if payment.provider == Payment.Provider.CLICK:
        return (
            f"{cfg['CLICK_CHECKOUT_URL']}?service_id={cfg['CLICK_SERVICE_ID']}"
            f"&merchant_id={cfg['CLICK_MERCHANT_ID']}&amount={payment.amount}"
            f"&transaction_param={payment.id}&return_url={base_return}"
        )
    if payment.provider == Payment.Provider.PAYME:
        raw = (
            f"m={cfg['PAYME_MERCHANT_ID']};ac.order_id={payment.id};"
            f"a={int(payment.amount) * 100};c={base_return};l=uz"
        )
        return f"{cfg['PAYME_CHECKOUT_URL']}/{base64.b64encode(raw.encode()).decode()}"
    if payment.provider == Payment.Provider.UZUM:
        service_id = cfg.get("UZUM_SERVICE_ID") or cfg.get("UZUM_MERCHANT_ID")
        return (
            f"{cfg['UZUM_CHECKOUT_URL']}/pay?serviceId={service_id}"
            f"&orderId={payment.id}&amount={payment.amount}&redirectUrl={base_return}"
        )
    if payment.provider in {Payment.Provider.HUMO, Payment.Provider.UZCARD}:
        merchant = cfg.get("HUMO_MERCHANT_ID") if payment.provider == Payment.Provider.HUMO else cfg.get("UZCARD_MERCHANT_ID")
        return f"{base_return}?provider={payment.provider}&order_id={payment.id}&merchant_id={merchant}&amount={payment.amount}"
    if payment.provider == Payment.Provider.GOOGLE_PAY:
        return f"{base_return}?provider=google_pay&order_id={payment.id}&amount={payment.amount}"
    if payment.provider == Payment.Provider.APPLE_PAY:
        return f"{base_return}?provider=apple_pay&order_id={payment.id}&amount={payment.amount}"
    if payment.provider == Payment.Provider.SANDBOX:
        return f"{settings.FRONTEND_URL}/checkout/sandbox/{payment.id}"
    return ""


@transaction.atomic
def create_payment(user, course, provider, billing_period=Payment.BillingPeriod.MONTHLY):
    course = Course.objects.select_for_update().get(pk=course.pk)
    if course.status != Course.Status.PUBLISHED:
        raise ValidationError("This course is not available for purchase.")
    if not provider_configured(provider):
        raise ValidationError("This payment provider is not configured yet.")
    amount = calculate_amount(course, billing_period)
    payment = Payment.objects.create(
        user=user,
        course=course,
        provider=provider,
        billing_period=billing_period,
        amount=amount,
        checkout_url="",
    )
    payment.checkout_url = build_checkout_url(payment)
    payment.save(update_fields=["checkout_url"])
    PaymentAuditLog.objects.create(payment=payment, action="created", actor=user, metadata={"provider": provider})
    return payment


def log_webhook(provider, payload, headers, ip, verified=False, payment=None, error=""):
    from .models import PaymentWebhookLog

    return PaymentWebhookLog.objects.create(
        provider=provider,
        payload=payload if isinstance(payload, (dict, list)) else {"raw": str(payload)},
        headers={key: str(value) for key, value in headers.items()},
        ip_address=ip,
        verified=verified,
        payment=payment,
        error=error[:255],
    )


def _apply_success(payment, provider_transaction_id, payload=None):
    now = timezone.now()
    payment.status = Payment.Status.SUCCESS
    payment.provider_transaction_id = provider_transaction_id
    payment.paid_at = now
    payment.provider_payload = payload or {}
    payment.failure_reason = ""
    payment.save(
        update_fields=[
            "status",
            "provider_transaction_id",
            "paid_at",
            "provider_payload",
            "failure_reason",
            "updated_at",
        ]
    )
    days = 365 if payment.billing_period == Payment.BillingPeriod.FULL else None
    subscription = activate_subscription(payment.user, payment.course, period_days=days)
    payment.subscription = subscription
    payment.save(update_fields=["subscription"])
    PaymentAuditLog.objects.create(
        payment=payment,
        action="succeeded",
        metadata={"provider_transaction_id": provider_transaction_id, "period_end": str(subscription.current_period_end)},
    )
    get_or_create_enrollment(payment.user, payment.course)
    _notify_success(payment, subscription)
    return payment


def mark_payment_success(payment_id, provider_transaction_id, provider=None, payload=None, expected_amount=None):
    """Single authoritative transition to paid. Safe for duplicate callbacks."""
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment_id)
        if provider and payment.provider != provider:
            raise ValidationError("Payment provider mismatch.")
        if expected_amount is not None and Decimal(payment.amount) != Decimal(expected_amount):
            raise ValidationError("Payment amount does not match the invoice.")
        if payment.status == Payment.Status.SUCCESS:
            logger.info("Duplicate success callback ignored for payment %s", payment.id)
            return payment, False
        if payment.status in {Payment.Status.REFUNDED}:
            raise ValidationError("Refunded payment cannot be completed.")
        if payment.provider_transaction_id and payment.provider_transaction_id != provider_transaction_id:
            raise ValidationError("Payment already linked to another provider transaction.")
        if not provider_transaction_id:
            raise ValidationError("Provider transaction id is required.")
        try:
            _apply_success(payment, str(provider_transaction_id), payload)
        except IntegrityError as exc:
            logger.warning("Duplicate provider transaction: %s", provider_transaction_id)
            raise ValidationError("Duplicate provider transaction id.") from exc
        return payment, True


def mark_payment_failed(payment_id, reason="", provider_transaction_id=None, payload=None):
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment_id)
        if payment.status == Payment.Status.SUCCESS:
            return payment, False
        payment.status = Payment.Status.FAILED
        payment.failure_reason = (reason or "Payment failed")[:255]
        if provider_transaction_id and not payment.provider_transaction_id:
            payment.provider_transaction_id = provider_transaction_id
        if payload:
            payment.provider_payload = payload
        payment.save()
        PaymentAuditLog.objects.create(payment=payment, action="failed", metadata={"reason": reason})
        _notify_failure(payment)
        return payment, True


def mark_payment_processing(payment_id, provider_transaction_id=None, payload=None):
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment_id)
        if payment.status in {Payment.Status.SUCCESS, Payment.Status.REFUNDED}:
            return payment
        payment.status = Payment.Status.PROCESSING
        if provider_transaction_id:
            payment.provider_transaction_id = str(provider_transaction_id)
        if payload:
            payment.provider_payload = payload
        payment.save()
        return payment


def _notify_success(payment, subscription):
    try:
        from apps.notifications.services import notify_user
        from apps.analytics.services import award_points

        notify_user(
            payment.user,
            "payment_success",
            title_uz="To'lov muvaffaqiyatli",
            title_ru="Платёж успешно выполнен",
            message_uz=f"{payment.course.title_uz} kursi ochildi. Obuna {subscription.current_period_end:%d.%m.%Y} gacha amal qiladi.",
            message_ru=f"Курс «{payment.course.title_ru}» открыт. Подписка действует до {subscription.current_period_end:%d.%m.%Y}.",
            data={"payment_id": payment.id, "course_slug": payment.course.slug},
            telegram=True,
            push=True,
        )
        award_points(payment.user, 20, "course_payment", reference=f"payment:{payment.id}")
    except Exception:
        logger.exception("Post-payment side effects failed for %s", payment.id)


def _notify_failure(payment):
    try:
        from apps.notifications.services import notify_user

        notify_user(
            payment.user,
            "payment_failed",
            title_uz="To'lov amalga oshmadi",
            title_ru="Платёж не выполнен",
            message_uz=f"{payment.course.title_uz} kursi uchun to'lov tasdiqlanmadi.",
            message_ru=f"Платёж за курс «{payment.course.title_ru}» не подтверждён.",
            data={"payment_id": payment.id, "course_slug": payment.course.slug},
            telegram=True,
            push=True,
        )
    except Exception:
        logger.exception("Payment failure notification failed for %s", payment.id)
