import tempfile

from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.courses.models import Course
from apps.courses.services import is_lesson_unlocked
from apps.subscriptions.models import Subscription, activate_subscription
from common.testing import (
    answers_for,
    complete_lesson,
    complete_video,
    create_category,
    create_course,
    create_lesson,
    create_quiz,
    create_section,
    create_user,
    force_login,
)

MEDIA_ROOT = tempfile.mkdtemp(prefix="ipa-quiz-tests-")


@override_settings(MEDIA_ROOT=MEDIA_ROOT, PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class QuizFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.teacher = create_user("teacher@quiz.uz", role="teacher")
        self.student = create_user("student@quiz.uz")
        self.category = create_category()
        self.course = create_course(self.teacher, self.category, slug="quiz-course", title="Quiz Course")
        self.section = create_section(self.course)
        self.lessons = [create_lesson(self.course, section=self.section, order=i) for i in range(3)]
        self.quizzes = [create_quiz(lesson) for lesson in self.lessons]
        activate_subscription(self.student, self.course)
        force_login(self.client, self.student)

    def start(self, index=0):
        response = self.client.post(f"/api/quizzes/{self.quizzes[index].id}/start/", {}, format="json")
        return response

    def submit(self, attempt_id, correct_count):
        from apps.quizzes.models import QuizAttempt

        attempt = QuizAttempt.objects.get(pk=attempt_id)
        return self.client.post(
            f"/api/quiz-attempts/{attempt_id}/submit/",
            {"answers": answers_for(attempt, correct_count)},
            format="json",
        )

    def test_start_returns_ten_questions_without_correct_flags(self):
        response = self.start(0)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(len(response.data["questions"]), 10)
        self.assertEqual(response.data["answers_required"], 10)
        self.assertEqual(response.data["passing_score"], 7)
        option = response.data["questions"][0]["options"][0]
        self.assertEqual(set(option.keys()), {"id", "text"})

    def test_seven_correct_answers_pass_and_unlock_next_lesson(self):
        start = self.start(0)
        attempt_id = start.data["attempt"]["id"]
        complete_video(self.student, self.lessons[0])
        response = self.submit(attempt_id, 7)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["passed"])
        self.assertEqual(response.data["correct_count"], 7)
        self.assertEqual(response.data["wrong_count"], 3)
        self.assertFalse(response.data["restart_required"])
        self.assertTrue(is_lesson_unlocked(self.student, self.course, self.lessons[1]))

    def test_ten_correct_answers_give_full_score(self):
        attempt_id = self.start(0).data["attempt"]["id"]
        response = self.submit(attempt_id, 10)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["score"], 10)
        self.assertTrue(response.data["passed"])

    def test_six_correct_four_wrong_requires_restart_and_keeps_lock(self):
        attempt_id = self.start(0).data["attempt"]["id"]
        complete_video(self.student, self.lessons[0])
        response = self.submit(attempt_id, 6)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data["passed"])
        self.assertEqual(response.data["wrong_count"], 4)
        self.assertTrue(response.data["restart_required"])
        self.assertFalse(is_lesson_unlocked(self.student, self.course, self.lessons[1]))

    def test_failure_always_has_at_least_four_wrong_and_restarts(self):
        attempt_id = self.start(0).data["attempt"]["id"]
        response = self.submit(attempt_id, 3)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data["passed"])
        self.assertEqual(response.data["wrong_count"], 7)
        self.assertTrue(response.data["restart_required"])

    def test_cannot_start_locked_quiz(self):
        response = self.start(1)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)

    def test_quiz_rejects_missing_answers_and_scores_zero_correct(self):
        attempt_id = self.start(0).data["attempt"]["id"]
        response = self.client.post(
            f"/api/quiz-attempts/{attempt_id}/submit/", {"answers": []}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["correct_count"], 0)
        self.assertEqual(response.data["wrong_count"], 10)
        self.assertTrue(response.data["restart_required"])

    def test_attempt_cannot_be_submitted_twice(self):
        attempt_id = self.start(0).data["attempt"]["id"]
        first = self.submit(attempt_id, 10)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.submit(attempt_id, 10)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retake_allowed_after_failure_and_attempt_number_increments(self):
        first_id = self.start(0).data["attempt"]["id"]
        self.submit(first_id, 6)
        second = self.start(0)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["attempt"]["attempt_number"], 2)
        self.assertFalse(second.data["resumed"])

    def test_in_progress_attempt_is_resumed(self):
        first = self.start(0)
        second = self.start(0)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["attempt"]["id"], second.data["attempt"]["id"])
        self.assertTrue(second.data["resumed"])

    def test_attempts_are_private_to_the_student(self):
        other = create_user("other@quiz.uz")
        activate_subscription(other, self.course)
        complete_lesson(other, self.lessons[0])
        force_login(self.client, other)
        mine = self.start(0).data["attempt"]["id"]
        force_login(self.client, self.student)
        response = self.client.get("/api/quiz-attempts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data["results"]]
        self.assertNotIn(mine, ids)

    def test_student_cannot_read_another_students_attempt(self):
        other = create_user("other2@quiz.uz")
        activate_subscription(other, self.course)
        force_login(self.client, other)
        attempt_id = self.start(0).data["attempt"]["id"]
        force_login(self.client, self.student)
        response = self.client.get(f"/api/quiz-attempts/{attempt_id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_expired_subscription_blocks_quiz(self):
        subscription = Subscription.objects.get(user=self.student, course=self.course)
        subscription.status = Subscription.Status.EXPIRED
        subscription.current_period_end = subscription.started_at
        subscription.grace_until = subscription.started_at
        subscription.save(update_fields=["status", "current_period_end", "grace_until"])
        response = self.start(0)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_quiz_questions_endpoint_does_not_expose_answers(self):
        attempt_id = self.start(0).data["attempt"]["id"]
        response = self.client.get(f"/api/quiz-attempts/{attempt_id}/questions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for option in response.data["questions"][0]["options"]:
            self.assertNotIn("is_correct", option)
