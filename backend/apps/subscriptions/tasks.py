from django.utils import timezone
from celery import shared_task
from datetime import timedelta

from .models import Subscription


@shared_task
def sync_subscription_statuses():
    updated = 0
    for subscription in Subscription.objects.filter(status__in=["active", "grace"]).iterator():
        old = subscription.status
        subscription.refresh_status(save=False)
        if subscription.status != old:
            subscription.save(update_fields=["status", "updated_at"])
            updated += 1
            if subscription.status == Subscription.Status.GRACE:
                _notify(subscription, "subscription_grace")
            elif subscription.status == Subscription.Status.EXPIRED:
                _notify(subscription, "subscription_expired")
    return updated


@shared_task
def send_subscription_reminders():
    now = timezone.now()
    sent = 0
    for subscription in Subscription.objects.filter(
        status=Subscription.Status.ACTIVE,
        current_period_end__lte=now + timedelta(days=3),
        current_period_end__gt=now,
        expiry_notified_at__isnull=True,
    ).select_related("user", "course"):
        _notify(subscription, "subscription_expiring", extra={"days": max(1, (subscription.current_period_end - now).days)})
        subscription.expiry_notified_at = now
        subscription.save(update_fields=["expiry_notified_at", "updated_at"])
        sent += 1
    return sent


def _notify(subscription, event, extra=None):
    from apps.notifications.services import notify_user

    titles = {
        "subscription_expiring": ("Obuna tugamoqda", "Подписка истекает"),
        "subscription_grace": ("3 kunlik imtiyoz davri boshlandi", "Начался 3-дневный льготный период"),
        "subscription_expired": ("Kursga kirish yopildi", "Доступ к курсу закрыт"),
    }
    title_uz, title_ru = titles.get(event, ("Obuna", "Подписка"))
    notify_user(
        subscription.user,
        event,
        title_uz=title_uz,
        title_ru=title_ru,
        message_uz=f"{subscription.course.title_uz} kursi obunasi uchun ma'lumot.",
        message_ru=f"Информация по подписке на курс «{subscription.course.title_ru}».",
        data={"course_id": subscription.course_id, "subscription_id": subscription.id, **(extra or {})},
        telegram=True,
        push=True,
    )
