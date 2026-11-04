from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.analytics.models import AuditLog, PointsTransaction, SystemSettings
from apps.analytics.services import award_points
from apps.notifications.models import Notification
from apps.payments.models import Payment
from apps.subscriptions.models import activate_subscription
from common.testing import (
    create_category,
    create_course,
    create_user,
    force_login,
)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AnalyticsApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.teacher = create_user("teacher@analytics.uz", role="teacher")
        self.student = create_user("student@analytics.uz", first_name="Ali")
        self.other = create_user("other@analytics.uz", first_name="Vali")
        self.admin = create_user("admin@analytics.uz", role="admin")
        self.category = create_category()
        self.course = create_course(
            self.teacher,
            self.category,
            slug="analytics-course",
            title="Analytics Course",
            monthly_price=100000,
        )
        activate_subscription(self.student, self.course)

    def test_health_and_public_stats_are_public(self):
        health = self.client.get("/api/health/")
        self.assertEqual(health.status_code, status.HTTP_200_OK)
        self.assertEqual(health.data["status"], "ok")
        self.assertTrue(health.data["checks"]["database"])

        stats = self.client.get("/api/stats/")
        self.assertEqual(stats.status_code, status.HTTP_200_OK)
        self.assertEqual(stats.data["courses"], 1)
        self.assertEqual(stats.data["students"], 2)
        self.assertEqual(stats.data["categories"], 1)

    def test_student_dashboard_returns_real_aggregates(self):
        award_points(self.student, 25, "test_bonus", reference="bonus:1")
        Notification.objects.create(
            user=self.student,
            type=Notification.Type.SYSTEM,
            title_uz="Salom",
            title_ru="Привет",
            message_uz="Xabar",
            message_ru="Сообщение",
        )
        force_login(self.client, self.student)
        response = self.client.get("/api/analytics/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        summary = response.data["summary"]
        self.assertEqual(summary["enrolled_courses"], 1)
        self.assertEqual(summary["completed_courses"], 0)
        self.assertEqual(summary["in_progress_courses"], 1)
        self.assertEqual(summary["points"], 25)
        self.assertEqual(summary["unread_notifications"], 1)
        self.assertEqual(len(response.data["enrollments"]), 1)
        self.assertEqual(response.data["enrollments"][0]["course"]["slug"], "analytics-course")

    def test_dashboard_requires_authentication(self):
        response = self.client.get("/api/analytics/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_teacher_and_admin_analytics_permissions(self):
        force_login(self.client, self.student)
        self.assertEqual(
            self.client.get("/api/analytics/teacher/").status_code, status.HTTP_403_FORBIDDEN
        )
        self.assertEqual(
            self.client.get("/api/analytics/admin/").status_code, status.HTTP_403_FORBIDDEN
        )

        force_login(self.client, self.teacher)
        teacher = self.client.get("/api/analytics/teacher/")
        self.assertEqual(teacher.status_code, status.HTTP_200_OK, teacher.data)
        self.assertEqual(teacher.data["summary"]["courses"], 1)
        self.assertEqual(teacher.data["summary"]["students"], 1)
        self.assertEqual(len(teacher.data["series"]), 31)
        self.assertEqual(teacher.data["courses"][0]["course"]["slug"], "analytics-course")

        force_login(self.client, self.admin)
        admin = self.client.get("/api/analytics/admin/")
        self.assertEqual(admin.status_code, status.HTTP_200_OK, admin.data)
        self.assertEqual(admin.data["summary"]["total_students"], 2)
        self.assertEqual(admin.data["summary"]["published_courses"], 1)
        recent_student = next(
            user for user in admin.data["recent_users"] if user["email"] == self.student.email
        )
        self.assertEqual(recent_student["enrollments_count"], 1)
        recent_teacher = next(
            user for user in admin.data["recent_users"] if user["email"] == self.teacher.email
        )
        self.assertEqual(recent_teacher["courses_count"], 1)

    def test_revenue_analytics_counts_successful_payments_only(self):
        Payment.objects.create(
            user=self.student,
            course=self.course,
            provider=Payment.Provider.SANDBOX,
            amount=Decimal("100000"),
            status=Payment.Status.SUCCESS,
            paid_at=timezone.now(),
        )
        Payment.objects.create(
            user=self.student,
            course=self.course,
            provider=Payment.Provider.SANDBOX,
            amount=Decimal("500000"),
            status=Payment.Status.FAILED,
        )
        force_login(self.client, self.teacher)
        response = self.client.get("/api/analytics/revenue/", {"range": "30d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["total"], 100000.0)
        self.assertEqual(response.data["transactions"], 1)
        self.assertEqual(response.data["in_range"], 100000.0)

    def test_leaderboard_ranks_students_by_points(self):
        award_points(self.student, 100, "test_bonus", reference="bonus:a")
        award_points(self.other, 10, "test_bonus", reference="bonus:b")
        force_login(self.client, self.student)
        response = self.client.get("/api/leaderboard/", {"type": "points", "period": "all"})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["total_students"], 2)
        self.assertEqual(response.data["results"][0]["user"]["full_name"], "Ali")
        self.assertTrue(response.data["results"][0]["is_me"])
        self.assertEqual(response.data["me"]["rank"], 1)
        self.assertEqual(response.data["results"][1]["user"]["full_name"], "Vali")

    def test_leaderboard_week_period_ignores_old_points(self):
        award_points(self.student, 100, "test_bonus", reference="bonus:old")
        transaction = PointsTransaction.objects.get(user=self.student, reason="test_bonus")
        transaction.created_at = timezone.now() - timedelta(days=20)
        transaction.save(update_fields=["created_at"])
        force_login(self.client, self.student)
        response = self.client.get("/api/leaderboard/", {"type": "points", "period": "week"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["me"]["points"], 0)

    def test_public_settings_hide_admin_fields_and_admin_can_patch(self):
        public = self.client.get("/api/settings/")
        self.assertEqual(public.status_code, status.HTTP_200_OK)
        self.assertIn("site_name", public.data)
        self.assertNotIn("click_enabled", public.data)

        force_login(self.client, self.student)
        forbidden = self.client.patch("/api/settings/", {"grace_period_days": 5}, format="json")
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        force_login(self.client, self.admin)
        response = self.client.patch(
            "/api/settings/", {"grace_period_days": 5, "quiz_passing_score": 8}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        settings_obj = SystemSettings.load()
        self.assertEqual(settings_obj.grace_period_days, 5)
        self.assertEqual(settings_obj.quiz_passing_score, 8)

    def test_audit_logs_are_admin_only(self):
        AuditLog.objects.create(user=self.admin, action="test", model_name="User", object_id="1")
        force_login(self.client, self.teacher)
        self.assertEqual(self.client.get("/api/audit-logs/").status_code, status.HTTP_403_FORBIDDEN)
        force_login(self.client, self.admin)
        response = self.client.get("/api/audit-logs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_categories_endpoint_returns_published_counts(self):
        response = self.client.get("/api/categories/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["course_count"], 1)
