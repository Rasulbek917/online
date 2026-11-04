from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    NotificationViewSet,
    PushDeviceViewSet,
    TelegramAccountView,
    TelegramWebhookView,
)

router = DefaultRouter()
router.register("notifications/devices", PushDeviceViewSet, basename="push-device")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("notifications/telegram/", TelegramAccountView.as_view(), name="telegram-account"),
    path("notifications/telegram/webhook/", TelegramWebhookView.as_view(), name="telegram-webhook"),
    path("", include(router.urls)),
]
