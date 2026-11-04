from datetime import timedelta

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.courses.models import Enrollment
from apps.notifications.models import Notification
from apps.subscriptions.models import (
    Subscription,
    activate_subscription,
    active_subscription,
    get_subscription,
)
from apps.subscriptions.tasks import send_subscription_reminders, sync_subscription_statuses
from common.testing import create_category, create_course, create_section, create_user


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class SubscriptionLifecycleTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.teacher = create_user("teacher@sub.uz", role="teacher")
        self.student = create_user("student@sub.uz")
        self.category = create_category()
        self.course = create_course(self.teacher, self.category)

    def make_subscription(self, *, period_end, grace_until, status=Subscription.Status.ACTIVE):
        now = timezone.now()
        return Subscription.objects.create(
            user=self.student,
            course=self.course,
            status=status,
            started_at=now - timedelta(days=30),
            current_period_start=now - timedelta(days=30),
            current_period_end=period_end,
            grace_until=grace_until,
        )

    def test_active_subscription_is_returned(self):
        self.make_subscription(
            period_end=timezone.now() + timedelta(days=5),
            grace_until=timezone.now() + timedelta(days=8),
        )
        self.assertIsNotNone(active_subscription(self.student, self.course))

    def test_expired_subscription_moves_through_grace_then_expires(self):
        now = timezone.now()
        subscription = self.make_subscription(
            period_end=now - timedelta(hours=1),
            grace_until=now + timedelta(days=2),
        )
        self.assertEqual(subscription.refresh_status(), Subscription.Status.GRACE)
        self.assertTrue(subscription.is_access_active)
        self.assertEqual(active_subscription(self.student, self.course).status, Subscription.Status.GRACE)

        subscription.grace_until = now - timedelta(hours=1)
        subscription.save(update_fields=["grace_until"])
        self.assertEqual(subscription.refresh_status(), Subscription.Status.EXPIRED)
        self.assertFalse(subscription.is_access_active)
        self.assertIsNone(active_subscription(self.student, self.course))

    def test_activate_subscription_creates_enrollment(self):
        subscription = activate_subscription(self.student, self.course)
        self.assertEqual(subscription.status, Subscription.Status.ACTIVE)
        self.assertTrue(Enrollment.objects.filter(user=self.student, course=self.course).exists())
        expected_days = 30
        delta = subscription.current_period_end - subscription.current_period_start
        self.assertEqual(delta.days, expected_days)
        grace_delta = subscription.grace_until - subscription.current_period_end
        self.assertEqual(grace_delta.days, 3)

    def test_renewal_extends_from_existing_period_end(self):
        first = activate_subscription(self.student, self.course)
        first_end = first.current_period_end
        first.current_period_end = timezone.now() + timedelta(days=10)
        first.grace_until = first.current_period_end + timedelta(days=3)
        first.save(update_fields=["current_period_end", "grace_until"])
        renewed = activate_subscription(self.student, self.course)
        self.assertEqual(Subscription.objects.filter(user=self.student, course=self.course).count(), 1)
        self.assertGreater(renewed.current_period_end, first_end)

    def test_canceled_subscription_stays_canceled(self):
        subscription = self.make_subscription(
            period_end=timezone.now() + timedelta(days=5),
            grace_until=timezone.now() + timedelta(days=8),
            status=Subscription.Status.CANCELED,
        )
        self.assertEqual(subscription.refresh_status(), Subscription.Status.CANCELED)

    def test_get_subscription_returns_none_for_anonymous(self):
        from django.contrib.auth.models import AnonymousUser

        self.assertIsNone(get_subscription(AnonymousUser(), self.course))

    def test_sync_task_moves_expired_subscription_and_notifies(self):
        now = timezone.now()
        subscription = self.make_subscription(
            period_end=now - timedelta(days=1),
            grace_until=now - timedelta(hours=1),
        )
        updated = sync_subscription_statuses()
        self.assertEqual(updated, 1)
        subscription.refresh_from_db()
        self.assertEqual(subscription.status, Subscription.Status.EXPIRED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.student, type=Notification.Type.SUBSCRIPTION_EXPIRED
            ).exists()
        )

    def test_reminder_task_is_idempotent(self):
        subscription = self.make_subscription(
            period_end=timezone.now() + timedelta(days=2),
            grace_until=timezone.now() + timedelta(days=5),
        )
        first = send_subscription_reminders()
        self.assertEqual(first, 1)
        subscription.refresh_from_db()
        self.assertIsNotNone(subscription.expiry_notified_at)
        second = send_subscription_reminders()
        self.assertEqual(second, 0)
        self.assertEqual(
            Notification.objects.filter(
                user=self.student, type=Notification.Type.SUBSCRIPTION_EXPIRING
            ).count(),
            1,
        )

    def test_reminder_skips_distant_subscriptions(self):
        self.make_subscription(
            period_end=timezone.now() + timedelta(days=20),
            grace_until=timezone.now() + timedelta(days=23),
        )
        self.assertEqual(send_subscription_reminders(), 0)

    def test_subscription_api_only_returns_own(self):
        from common.testing import force_login

        other = create_user("other@sub.uz")
        activate_subscription(self.student, self.course)
        other_course = create_course(
            self.teacher, self.category, slug="other-course", title="Other Course"
        )
        activate_subscription(other, other_course)
        force_login(self.client, self.student)
        response = self.client.get("/api/subscriptions/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["course"]["slug"], self.course.slug)
