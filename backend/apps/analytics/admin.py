from django.contrib import admin

from .models import (
    ActivityEvent,
    AuditLog,
    DailyAnalytics,
    Leaderboard,
    PointsTransaction,
    StudentPoints,
    SystemSettings,
    Testimonial,
)


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    list_display = ("site_name", "default_language", "grace_period_days", "maintenance_mode")

    def has_add_permission(self, request):
        return not SystemSettings.objects.exists()


@admin.register(StudentPoints)
class StudentPointsAdmin(admin.ModelAdmin):
    list_display = ("user", "points")
    search_fields = ("user__email",)
    autocomplete_fields = ("user",)


@admin.register(PointsTransaction)
class PointsTransactionAdmin(admin.ModelAdmin):
    list_display = ("user", "points", "reason", "reference", "created_at")
    list_filter = ("reason",)
    search_fields = ("user__email", "reference")


@admin.register(Leaderboard)
class LeaderboardAdmin(admin.ModelAdmin):
    list_display = ("period", "rank", "user", "points", "completed_courses", "quiz_accuracy")
    list_filter = ("period",)


@admin.register(DailyAnalytics)
class DailyAnalyticsAdmin(admin.ModelAdmin):
    list_display = ("date", "revenue", "new_students", "enrollments", "quiz_passes", "new_certificates")


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ("name", "role_uz", "rating", "is_approved", "is_featured", "order")
    list_filter = ("is_approved", "is_featured")
    search_fields = ("name", "quote_uz")


@admin.register(ActivityEvent)
class ActivityEventAdmin(admin.ModelAdmin):
    list_display = ("event", "user", "created_at")
    list_filter = ("event",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "user", "model_name", "object_id", "ip_address", "created_at")
    list_filter = ("action",)
    search_fields = ("user__email", "action", "object_id")
    readonly_fields = ("user", "action", "model_name", "object_id", "ip_address", "metadata")
