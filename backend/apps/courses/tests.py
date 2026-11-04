import tempfile

from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APITestCase

from apps.courses.models import Course, Enrollment
from apps.courses.services import (
    course_progress,
    has_course_access,
    is_lesson_unlocked,
    issue_video_token,
    parse_video_token,
    resolve_video_access,
)
from apps.subscriptions.models import activate_subscription
from common.testing import (
    complete_lesson,
    create_category,
    create_course,
    create_lesson,
    create_quiz,
    create_section,
    create_user,
    force_login,
)

MEDIA_ROOT = tempfile.mkdtemp(prefix="ipa-courses-tests-")


@override_settings(MEDIA_ROOT=MEDIA_ROOT, PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CourseApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.teacher = create_user("teacher@test.uz", role="teacher", first_name="Teacher")
        self.student = create_user("student@test.uz", first_name="Student")
        self.other = create_user("other@test.uz", first_name="Other")
        self.category = create_category()
        self.course = create_course(self.teacher, self.category)
        self.section = create_section(self.course)
        self.lessons = [
            create_lesson(self.course, section=self.section, order=index)
            for index in range(4)
        ]
        for lesson in self.lessons:
            create_quiz(lesson)
        activate_subscription(self.student, self.course)

    def test_catalog_is_public_and_searchable(self):
        response = self.client.get("/api/courses/", {"search": "Test Course"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "test-course")

    def test_teacher_card_reports_real_course_and_student_counts(self):
        create_course(
            self.teacher,
            self.category,
            slug="second-course",
            title="Second Course",
        )
        response = self.client.get("/api/courses/test-course/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        teacher = response.data["teacher"]
        self.assertEqual(teacher["courses_count"], 2)
        self.assertEqual(teacher["students_count"], 1)

    def test_course_detail_progress_is_json_serializable(self):
        complete_lesson(self.student, self.lessons[0])
        force_login(self.client, self.student)
        response = self.client.get("/api/courses/test-course/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["progress"]["percent"], 25)
        self.assertEqual(response.data["progress"]["completed_lessons"], 1)
        self.assertIn("next_lesson_id", response.data["progress"])
        self.assertTrue(response.data["has_access"])
        self.assertTrue(response.data["is_enrolled"])

    def test_free_course_requires_enrollment_for_access(self):
        free_course = create_course(
            self.teacher,
            self.category,
            slug="free-course",
            title="Free Course",
            is_free=True,
            price=0,
            monthly_price=0,
        )
        self.assertFalse(has_course_access(self.student, free_course))
        Enrollment.objects.create(user=self.student, course=free_course)
        self.assertTrue(has_course_access(self.student, free_course))

    def test_lesson_locking_follows_previous_completion(self):
        self.assertTrue(is_lesson_unlocked(self.student, self.course, self.lessons[0]))
        self.assertFalse(is_lesson_unlocked(self.student, self.course, self.lessons[1]))
        complete_lesson(self.student, self.lessons[0])
        self.assertTrue(is_lesson_unlocked(self.student, self.course, self.lessons[1]))
        self.assertFalse(is_lesson_unlocked(self.student, self.course, self.lessons[2]))

    def test_expired_or_missing_subscription_blocks_access(self):
        from apps.subscriptions.models import Subscription

        subscription = Subscription.objects.get(user=self.student, course=self.course)
        subscription.current_period_end = subscription.started_at
        subscription.grace_until = subscription.started_at
        subscription.status = Subscription.Status.EXPIRED
        subscription.save()
        self.assertFalse(has_course_access(self.student, self.course))

    def test_stream_requires_valid_signed_token(self):
        video = self.lessons[0].videos.first()
        response = self.client.get(f"/api/videos/{video.id}/stream/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        token = issue_video_token(self.student, video)
        response = self.client.get(
            f"/api/videos/{video.id}/stream/",
            {"token": token},
            HTTP_RANGE="bytes=0-99",
        )
        self.assertEqual(response.status_code, status.HTTP_206_PARTIAL_CONTENT)
        body = b"".join(response.streaming_content)
        self.assertEqual(len(body), 100)
        self.assertIn("bytes 0-99/", response["Content-Range"])

    def test_stream_rejects_token_for_another_video(self):
        first = self.lessons[0].videos.first()
        second = self.lessons[1].videos.first()
        token = issue_video_token(self.student, first)
        response = self.client.get(f"/api/videos/{second.id}/stream/", {"token": token})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_stream_rejects_user_without_subscription(self):
        video = self.lessons[0].videos.first()
        token = issue_video_token(self.other, video)
        response = self.client.get(f"/api/videos/{video.id}/stream/", {"token": token})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_expired_video_token_is_rejected(self):
        video = self.lessons[0].videos.first()
        token = issue_video_token(self.student, video)
        with self.assertRaises(ValidationError):
            parse_video_token(token, max_age=-1)

    def test_preview_lesson_is_streamable_without_subscription(self):
        preview_lesson = create_lesson(
            self.course, section=create_section(self.course, order=5), title="Preview", preview=True
        )
        video = preview_lesson.videos.first()
        resolve_video_access(self.other, video)
        token = issue_video_token(self.other, video)
        response = self.client.get(f"/api/videos/{video.id}/stream/", {"token": token})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_locked_lesson_stream_is_forbidden_even_with_subscription(self):
        video = self.lessons[2].videos.first()
        resolve_video_access(self.student, self.lessons[0].videos.first())
        with self.assertRaises(PermissionDenied):
            resolve_video_access(self.student, video)

    def test_student_cannot_create_course(self):
        force_login(self.client, self.student)
        payload = {
            "title_uz": "Illegal course",
            "title_ru": "Незаконный курс",
            "category_id": self.category.id,
            "monthly_price": 100000,
        }
        response = self.client.post("/api/courses/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_can_create_and_publish_own_course(self):
        force_login(self.client, self.teacher)
        payload = {
            "title_uz": "New Teacher Course",
            "title_ru": "Новый курс преподавателя",
            "short_description_uz": "Short",
            "short_description_ru": "Коротко",
            "category_id": self.category.id,
            "level": "beginner",
            "monthly_price": 150000,
            "price": 1500000,
        }
        response = self.client.post("/api/courses/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        slug = response.data["slug"]

        section = create_section(Course.objects.get(slug=slug))
        create_lesson(Course.objects.get(slug=slug), section=section)
        response = self.client.post(f"/api/courses/{slug}/publish/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["status"], "published")

    def test_course_progress_completes_and_creates_enrollment_cache(self):
        for lesson in self.lessons:
            complete_lesson(self.student, lesson)
        progress = course_progress(self.student, self.course)
        self.assertEqual(progress["percent"], 100)
        self.assertTrue(progress["is_complete"])
        enrollment = Enrollment.objects.get(user=self.student, course=self.course)
        self.assertEqual(enrollment.progress_percent, 100)
        self.assertIsNotNone(enrollment.completed_at)

    def test_my_courses_only_returns_teacher_courses(self):
        force_login(self.client, self.teacher)
        response = self.client.get("/api/courses/mine/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
