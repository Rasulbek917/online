from django.contrib import admin

from .models import Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "course", "status", "current_period_end", "grace_until", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("user__email", "course__title_uz")
    autocomplete_fields = ("user", "course")
    readonly_fields = ("created_at", "updated_at")
