from celery import shared_task

from .services import _send_push, _send_telegram


@shared_task
def send_telegram_for_notification(notification_id):
    return _send_telegram(notification_id)


@shared_task
def send_push_for_notification(notification_id):
    return _send_push(notification_id)


@shared_task
def send_telegram_message_task(chat_id, text):
    from .services import send_telegram_message

    return send_telegram_message(chat_id, text)
