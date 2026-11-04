from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.notifications.models import Broadcast, Notification, PushDevice, TelegramAccount
from apps.subscriptions.models import activate_subscription
from common.testing import (
    create_category,
    create_course,
    create_user,
    force_login,
)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class NotificationApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.teacher = create_user("teacher@notify.uz", role="teacher")
        self.student = create_user("student@notify.uz", first_name="Student")
        self.other = create_user("other@notify.uz", first_name="Other")
        self.admin = create_user("admin@notify.uz", role="admin")
        self.category = create_category()
        self.course = create_course(self.teacher, self.category, slug="notify-course", title="Notify Course")
        activate_subscription(self.student, self.course)

    def make_notification(self, user, **extra):
        defaults = {
            "type": Notification.Type.SYSTEM,
            "title_uz": "Sarlavha",
            "title_ru": "Заголовок",
            "message_uz": "Xabar matni",
            "message_ru": "Текст сообщения",
        }
        defaults.update(extra)
        return Notification.objects.create(user=user, **defaults)

    def test_list_returns_only_own_notifications(self):
        mine = self.make_notification(self.student)
        self.make_notification(self.other)
        force_login(self.client, self.student)
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], mine.id)

        detail = self.client.get(f"/api/notifications/{mine.id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)

    def test_cannot_read_another_users_notification(self):
        other = self.make_notification(self.other)
        force_login(self.client, self.student)
        response = self.client.get(f"/api/notifications/{other.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        response = self.client.post(f"/api/notifications/{other.id}/read/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_read_updates_timestamp_idempotently(self):
        notification = self.make_notification(self.student)
        force_login(self.client, self.student)
        response = self.client.post(f"/api/notifications/{notification.id}/read/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["is_read"])
        notification.refresh_from_db()
        self.assertIsNotNone(notification.read_at)

        first_read_at = notification.read_at
        response = self.client.post(f"/api/notifications/{notification.id}/read/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertEqual(notification.read_at, first_read_at)

    def test_read_all_and_unread_count_and_filters(self):
        first = self.make_notification(self.student)
        self.make_notification(self.student, type=Notification.Type.QUIZ_RESULT)
        force_login(self.client, self.student)

        count = self.client.get("/api/notifications/unread-count/")
        self.assertEqual(count.data["count"], 2)

        filtered = self.client.get("/api/notifications/", {"type": "quiz_result"})
        self.assertEqual(filtered.data["count"], 1)

        unread = self.client.get("/api/notifications/", {"unread": "1"})
        self.assertEqual(unread.data["count"], 2)

        response = self.client.post("/api/notifications/read-all/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated"], 2)
        self.assertEqual(self.client.get("/api/notifications/unread-count/").data["count"], 0)
        first.refresh_from_db()
        self.assertTrue(first.is_read)

    def test_notifications_require_authentication(self):
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_student_cannot_broadcast(self):
        force_login(self.client, self.student)
        response = self.client.post(
            "/api/notifications/broadcast/",
            {
                "title_uz": "Test",
                "title_ru": "Тест",
                "message_uz": "Xabar",
                "message_ru": "Сообщение",
                "audience": "students",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_can_broadcast_only_to_own_course_students(self):
        force_login(self.client, self.teacher)
        forbidden = self.client.post(
            "/api/notifications/broadcast/",
            {
                "title_uz": "Hammaga",
                "title_ru": "Всем",
                "message_uz": "Xabar",
                "message_ru": "Сообщение",
                "audience": "all",
            },
            format="json",
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        missing_course = self.client.post(
            "/api/notifications/broadcast/",
            {
                "title_uz": "Kurs",
                "title_ru": "Курс",
                "message_uz": "Xabar",
                "message_ru": "Сообщение",
                "audience": "course",
            },
            format="json",
        )
        self.assertEqual(missing_course.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            "/api/notifications/broadcast/",
            {
                "title_uz": "Yangi dars",
                "title_ru": "Новый урок",
                "message_uz": "Yangi dars qo'shildi",
                "message_ru": "Добавлен новый урок",
                "audience": "course",
                "course_slug": self.course.slug,
                "type": "new_lesson",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["sent"], 1)
        self.assertTrue(
            Notification.objects.filter(
                user=self.student, type=Notification.Type.NEW_LESSON
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                user=self.other, type=Notification.Type.NEW_LESSON
            ).exists()
        )
        broadcast = Broadcast.objects.get()
        self.assertEqual(broadcast.recipients_count, 1)
        self.assertEqual(broadcast.created_by, self.teacher)

        history = self.client.get("/api/notifications/broadcasts/")
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(history.data["count"], 1)
        self.assertEqual(history.data["results"][0]["audience"], "course")

    def test_admin_broadcast_to_all_students(self):
        force_login(self.client, self.admin)
        response = self.client.post(
            "/api/notifications/broadcast/",
            {
                "title_uz": "Yangilik",
                "title_ru": "Новость",
                "message_uz": "Yangi kurslar",
                "message_ru": "Новые курсы",
                "audience": "students",
                "type": "new_course",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["sent"], 2)
        self.assertEqual(
            Notification.objects.filter(type=Notification.Type.NEW_COURSE).count(), 2
        )

    def test_push_device_registration_and_deactivation(self):
        force_login(self.client, self.student)
        response = self.client.post(
            "/api/notifications/devices/",
            {"token": "device-token-1", "platform": "android", "device_name": "Pixel"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        device_id = response.data["id"]
        self.assertEqual(PushDevice.objects.count(), 1)

        again = self.client.post(
            "/api/notifications/devices/",
            {"token": "device-token-1", "platform": "android", "device_name": "Pixel 7"},
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_201_CREATED, again.data)
        self.assertEqual(again.data["id"], device_id)
        self.assertEqual(PushDevice.objects.count(), 1)
        self.assertEqual(PushDevice.objects.get().device_name, "Pixel 7")

        listing = self.client.get("/api/notifications/devices/")
        self.assertEqual(listing.data["count"], 1)

        deleted = self.client.delete(f"/api/notifications/devices/{device_id}/")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PushDevice.objects.get(pk=device_id).is_active)
        self.assertEqual(self.client.get("/api/notifications/devices/").data["count"], 0)

    def test_push_device_tokens_are_scoped_per_user(self):
        force_login(self.client, self.student)
        device = self.client.post(
            "/api/notifications/devices/", {"token": "shared-token"}, format="json"
        ).data
        force_login(self.client, self.other)
        listing = self.client.get("/api/notifications/devices/")
        self.assertEqual(listing.data["count"], 0)
        self.assertEqual(
            self.client.delete(f"/api/notifications/devices/{device['id']}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_telegram_link_lifecycle(self):
        force_login(self.client, self.student)
        initial = self.client.get("/api/notifications/telegram/")
        self.assertEqual(initial.status_code, status.HTTP_200_OK)
        self.assertFalse(initial.data["is_linked"])

        created = self.client.post("/api/notifications/telegram/", {}, format="json")
        self.assertEqual(created.status_code, status.HTTP_200_OK, created.data)
        self.assertIn("token", created.data)
        self.assertIn("t.me", created.data["deep_link"])
        account = TelegramAccount.objects.get(user=self.student)
        self.assertEqual(created.data["token"], account.link_token)
        self.assertFalse(account.is_linked)

        from django.utils import timezone

        account.chat_id = 123456789
        account.linked_at = timezone.now()
        account.save(update_fields=["chat_id", "linked_at"])
        linked = self.client.get("/api/notifications/telegram/")
        self.assertTrue(linked.data["is_linked"])
        self.assertIsNone(linked.data["deep_link"])

        unlinked = self.client.delete("/api/notifications/telegram/")
        self.assertEqual(unlinked.status_code, status.HTTP_200_OK)
        account.refresh_from_db()
        self.assertFalse(account.is_linked)
        self.assertIsNone(account.chat_id)

    def test_broadcast_history_requires_staff_role(self):
        force_login(self.client, self.student)
        response = self.client.get("/api/notifications/broadcasts/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
