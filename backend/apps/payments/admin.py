from django.contrib import admin

from .models import Payment, PaymentAuditLog, PaymentWebhookLog


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "course", "provider", "amount", "status", "paid_at", "created_at")
    list_filter = ("provider", "status", "billing_period", "created_at")
    search_fields = ("user__email", "course__title_uz", "provider_transaction_id")
    autocomplete_fields = ("user", "course")
    readonly_fields = ("idempotency_key", "provider_payload", "created_at", "updated_at")
    date_hierarchy = "created_at"


@admin.register(PaymentWebhookLog)
class PaymentWebhookLogAdmin(admin.ModelAdmin):
    list_display = ("provider", "verified", "processed", "payment", "ip_address", "created_at")
    list_filter = ("provider", "verified", "processed")
    readonly_fields = ("payload", "headers")


@admin.register(PaymentAuditLog)
class PaymentAuditLogAdmin(admin.ModelAdmin):
    list_display = ("payment", "action", "actor", "created_at")
    list_filter = ("action",)
