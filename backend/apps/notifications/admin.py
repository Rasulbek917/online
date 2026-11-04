from django.contrib import admin

from .models import Notification, PushDevice, TelegramAccount


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "type", "title_uz", "is_read", "created_at")
    list_filter = ("type", "is_read", "created_at")
    search_fields = ("user__email", "title_uz", "title_ru")
    autocomplete_fields = ("user",)


@admin.register(TelegramAccount)
class TelegramAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "username", "linked_at", "notifications_enabled")
    search_fields = ("user__email", "username", "chat_id")
    autocomplete_fields = ("user",)


@admin.register(PushDevice)
class PushDeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "device_name", "is_active", "last_seen_at")
    list_filter = ("platform", "is_active")
    search_fields = ("user__email", "token")
