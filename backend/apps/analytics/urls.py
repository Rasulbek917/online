from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminAnalyticsView,
    AuditLogViewSet,
    LeaderboardView,
    RevenueAnalyticsView,
    SettingsView,
    StudentDashboardView,
    TeacherAnalyticsView,
)

router = DefaultRouter()
router.register("audit-logs", AuditLogViewSet, basename="audit-log")

urlpatterns = [
    path("analytics/dashboard/", StudentDashboardView.as_view(), name="student-dashboard"),
    path("analytics/teacher/", TeacherAnalyticsView.as_view(), name="teacher-analytics"),
    path("analytics/admin/", AdminAnalyticsView.as_view(), name="admin-analytics"),
    path("analytics/revenue/", RevenueAnalyticsView.as_view(), name="revenue-analytics"),
    path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
    path("settings/", SettingsView.as_view(), name="settings"),
    path("", include(router.urls)),
]
