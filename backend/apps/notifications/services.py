import json
import logging
import time
from pathlib import Path

import jwt
import requests
from django.conf import settings

from .models import Notification

logger = logging.getLogger("apps.notifications")


def notify_user(
    user,
    event_type,
    title_uz,
    title_ru,
    message_uz,
    message_ru,
    data=None,
    telegram=False,
    push=False,
):
    notification = Notification.objects.create(
        user=user,
        type=event_type if event_type in Notification.Type.values else Notification.Type.SYSTEM,
        title_uz=title_uz,
        title_ru=title_ru,
        message_uz=message_uz,
        message_ru=message_ru,
        data=data or {},
    )
    if telegram:
        try:
            from .tasks import send_telegram_for_notification as telegram_task

            telegram_task.delay(notification.id)
        except Exception:
            logger.exception("Failed to enqueue Telegram notification %s", notification.id)
    if push:
        try:
            from .tasks import send_push_for_notification as push_task

            push_task.delay(notification.id)
        except Exception:
            logger.exception("Failed to enqueue push notification %s", notification.id)
    return notification


def send_telegram_message(chat_id, text):
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        logger.info("Telegram bot token is not configured; skipping message")
        return False
    try:
        response = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True},
            timeout=10,
        )
        if response.status_code >= 400:
            logger.warning("Telegram API error %s: %s", response.status_code, response.text[:300])
            return False
        return True
    except requests.RequestException:
        logger.exception("Telegram request failed")
        return False


def send_telegram_for_notification(notification_id):
    return _send_telegram(notification_id)


def _send_telegram(notification_id):
    from .models import TelegramAccount

    try:
        notification = Notification.objects.select_related("user", "user__profile").get(pk=notification_id)
        account = TelegramAccount.objects.filter(user=notification.user).first()
        if not account or not account.is_linked or not account.notifications_enabled:
            return False
        language = notification.user.profile.language
        title = notification.title_ru if language == "ru" else notification.title_uz
        message = notification.message_ru if language == "ru" else notification.message_uz
        return send_telegram_message(account.chat_id, f"<b>{title}</b>\n\n{message}")
    except Notification.DoesNotExist:
        return False


# ---------------------------------------------------------------------------
# Firebase Cloud Messaging (HTTP v1)
# ---------------------------------------------------------------------------
_fcm_cache = {"token": None, "expires_at": 0}


def _firebase_credentials():
    if settings.FIREBASE_CREDENTIALS_JSON:
        return json.loads(settings.FIREBASE_CREDENTIALS_JSON)
    if settings.FIREBASE_CREDENTIALS_FILE:
        path = Path(settings.FIREBASE_CREDENTIALS_FILE)
        if path.exists():
            return json.loads(path.read_text())
    return None


def _fcm_access_token():
    credentials = _firebase_credentials()
    if not credentials:
        return None
    now = int(time.time())
    if _fcm_cache["token"] and _fcm_cache["expires_at"] > now + 60:
        return _fcm_cache["token"]
    assertion = jwt.encode(
        {
            "iss": credentials["client_email"],
            "scope": "https://www.googleapis.com/auth/firebase.messaging",
            "aud": credentials.get("token_uri", "https://oauth2.googleapis.com/token"),
            "iat": now,
            "exp": now + 3600,
        },
        credentials["private_key"],
        algorithm="RS256",
    )
    try:
        response = requests.post(
            credentials.get("token_uri", "https://oauth2.googleapis.com/token"),
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        _fcm_cache["token"] = data["access_token"]
        _fcm_cache["expires_at"] = now + int(data.get("expires_in", 3600))
        return data["access_token"]
    except Exception:
        logger.exception("Could not obtain Firebase access token")
        return None


def send_push_to_devices(user, notification):
    from .models import PushDevice

    if not settings.FIREBASE_PROJECT_ID:
        return 0
    access_token = _fcm_access_token()
    if not access_token:
        return 0
    language = user.profile.language
    title = notification.title_ru if language == "ru" else notification.title_uz
    body = notification.message_ru if language == "ru" else notification.message_uz
    sent = 0
    devices = PushDevice.objects.filter(user=user, is_active=True)
    for device in devices:
        payload = {
            "message": {
                "token": device.token,
                "notification": {"title": title, "body": body},
                "data": {key: str(value) for key, value in (notification.data or {}).items()}
                | {"type": notification.type, "notification_id": str(notification.id)},
                "android": {"priority": "high", "notification": {"channel_id": "itpark_default"}},
            }
        }
        try:
            response = requests.post(
                f"https://fcm.googleapis.com/v1/projects/{settings.FIREBASE_PROJECT_ID}/messages:send",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json=payload,
                timeout=10,
            )
            if response.status_code in {200, 201}:
                sent += 1
            elif response.status_code in {404, 400} and "UNREGISTERED" in response.text:
                device.is_active = False
                device.save(update_fields=["is_active", "updated_at"])
            else:
                logger.warning("FCM error %s: %s", response.status_code, response.text[:300])
        except requests.RequestException:
            logger.exception("FCM request failed")
    return sent


def send_push_for_notification(notification_id):
    return _send_push(notification_id)


def _send_push(notification_id):
    try:
        notification = Notification.objects.select_related("user", "user__profile").get(pk=notification_id)
        return send_push_to_devices(notification.user, notification)
    except Notification.DoesNotExist:
        return 0
