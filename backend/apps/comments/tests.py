from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.comments.models import Comment, CommentReply
from apps.notifications.models import Notification
from apps.subscriptions.models import activate_subscription
from common.testing import (
    create_category,
    create_course,
    create_lesson,
    create_section,
    create_user,
    force_login,
)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CommentApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.teacher = create_user("teacher@comments.uz", role="teacher", first_name="Teacher")
        self.student = create_user("student@comments.uz", first_name="Student")
        self.other = create_user("other@comments.uz", first_name="Other")
        self.admin = create_user("admin@comments.uz", role="admin")
        self.category = create_category()
        self.course = create_course(self.teacher, self.category, slug="comment-course", title="Comment Course")
        self.section = create_section(self.course)
        self.lesson = create_lesson(self.course, section=self.section, order=0, title="Lesson One")
        activate_subscription(self.student, self.course)

    def create_comment(self, user=None, body="How does this work?", lesson=None):
        user = user or self.student
        force_login(self.client, user)
        payload = {"course_slug": self.course.slug, "body": body}
        if lesson is not False:
            payload["lesson_id"] = (lesson or self.lesson).id
        return self.client.post("/api/comments/", payload, format="json")

    def test_student_with_access_can_comment_and_teacher_is_notified(self):
        response = self.create_comment()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["body"], "How does this work?")
        self.assertEqual(response.data["lesson_title"], "Lesson One")
        self.assertTrue(response.data["is_owner"])
        comment = Comment.objects.get(pk=response.data["id"])
        self.assertEqual(comment.user, self.student)
        self.assertTrue(
            Notification.objects.filter(user=self.teacher, type=Notification.Type.COMMENT).exists()
        )

    def test_comment_list_is_public_and_filters_by_course_and_lesson(self):
        self.create_comment()
        response = self.client.get("/api/comments/", {"course_slug": self.course.slug})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["user"]["full_name"], "Student")

        response = self.client.get(
            "/api/comments/", {"course_slug": self.course.slug, "lesson_id": self.lesson.id}
        )
        self.assertEqual(response.data["count"], 1)
        response = self.client.get(
            "/api/comments/", {"course_slug": self.course.slug, "lesson_id": self.lesson.id + 999}
        )
        self.assertEqual(response.data["count"], 0)

    def test_course_level_comment_without_lesson_is_allowed(self):
        response = self.create_comment(lesson=False)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data["lesson"])

    def test_student_without_subscription_cannot_comment_on_lesson(self):
        response = self.create_comment(user=self.other)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_empty_body_is_rejected(self):
        force_login(self.client, self.student)
        response = self.client.post(
            "/api/comments/",
            {"course_slug": self.course.slug, "lesson_id": self.lesson.id, "body": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_comment_on_lesson_of_another_course_is_rejected(self):
        other_course = create_course(
            self.teacher, self.category, slug="other-comment-course", title="Other"
        )
        other_lesson = create_lesson(other_course, section=create_section(other_course))
        response = self.create_comment(lesson=other_lesson)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_teacher_reply_notifies_student_and_is_visible(self):
        comment_id = self.create_comment().data["id"]
        force_login(self.client, self.teacher)
        response = self.client.post(
            f"/api/comments/{comment_id}/reply/", {"body": "Check the video again."}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["body"], "Check the video again.")
        self.assertTrue(CommentReply.objects.filter(comment_id=comment_id).exists())
        self.assertTrue(
            Notification.objects.filter(user=self.student, type=Notification.Type.COMMENT).exists()
        )

        listing = self.client.get("/api/comments/", {"course_slug": self.course.slug})
        self.assertEqual(listing.data["results"][0]["replies_count"], 1)
        self.assertEqual(len(listing.data["results"][0]["replies"]), 1)

    def test_student_without_access_cannot_reply(self):
        comment_id = self.create_comment().data["id"]
        force_login(self.client, self.other)
        response = self.client.post(
            f"/api/comments/{comment_id}/reply/", {"body": "Spam"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_delete_and_content_is_hidden(self):
        comment_id = self.create_comment().data["id"]
        force_login(self.client, self.student)
        response = self.client.delete(f"/api/comments/{comment_id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        comment = Comment.objects.get(pk=comment_id)
        self.assertTrue(comment.is_deleted)
        self.assertEqual(comment.body, "")

        listing = self.client.get("/api/comments/", {"course_slug": self.course.slug})
        self.assertEqual(listing.data["count"], 0)
        with_deleted = self.client.get(
            "/api/comments/", {"course_slug": self.course.slug, "include_deleted": "1"}
        )
        self.assertEqual(with_deleted.data["count"], 1)
        self.assertEqual(with_deleted.data["results"][0]["body"], "")

    def test_other_student_cannot_delete_comment(self):
        comment_id = self.create_comment().data["id"]
        force_login(self.client, self.other)
        response = self.client.delete(f"/api/comments/{comment_id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_only_teacher_or_admin_can_pin(self):
        comment_id = self.create_comment().data["id"]
        force_login(self.client, self.student)
        forbidden = self.client.post(f"/api/comments/{comment_id}/pin/", {}, format="json")
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        force_login(self.client, self.teacher)
        response = self.client.post(f"/api/comments/{comment_id}/pin/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["is_pinned"])
        response = self.client.post(f"/api/comments/{comment_id}/pin/", {}, format="json")
        self.assertFalse(response.data["is_pinned"])

        force_login(self.client, self.admin)
        response = self.client.post(f"/api/comments/{comment_id}/pin/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_mine_filter_returns_only_own_comments(self):
        self.create_comment()
        comment_id = Comment.objects.get().id
        force_login(self.client, self.other)
        other_comment = Comment.objects.create(
            course=self.course, user=self.other, body="Other question"
        )
        response = self.client.get("/api/comments/", {"mine": "1"})
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], other_comment.id)
        self.assertNotEqual(comment_id, other_comment.id)

    def test_teacher_scope_returns_only_own_course_comments(self):
        self.create_comment()
        force_login(self.client, self.teacher)
        response = self.client.get("/api/comments/", {"scope": "teacher"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

        force_login(self.client, self.other)
        response = self.client.get("/api/comments/", {"scope": "teacher"})
        self.assertEqual(response.data["count"], 0)

    def test_reply_endpoint_as_teacher_alias(self):
        comment_id = self.create_comment().data["id"]
        force_login(self.client, self.teacher)
        response = self.client.post(
            f"/api/comments/{comment_id}/reply_as_teacher/", {"body": "Answer"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_deleted_comment_cannot_be_replied_to(self):
        comment_id = self.create_comment().data["id"]
        force_login(self.client, self.student)
        self.client.delete(f"/api/comments/{comment_id}/")
        force_login(self.client, self.teacher)
        response = self.client.post(
            f"/api/comments/{comment_id}/reply/", {"body": "Late answer"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
