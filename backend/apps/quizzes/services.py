import random
import re
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.courses.services import course_progress, has_course_access, is_lesson_unlocked, lesson_completed
from .models import AnswerOption, Question, Quiz, QuizAnswer, QuizAttempt


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def can_take_quiz(user, quiz):
    lesson = quiz.lesson
    course = lesson.section.course
    if user.role == "admin" or user.is_superuser or course.teacher_id == user.id:
        return True
    if not (lesson.is_free_preview or has_course_access(user, course)):
        return False
    if lesson.is_free_preview:
        return True
    return is_lesson_unlocked(user, course, lesson)


def start_attempt(user, quiz):
    if not quiz.is_active:
        raise ValidationError("This quiz is not active.")
    if not can_take_quiz(user, quiz):
        raise PermissionDenied("Complete the previous lessons to unlock this quiz.")
    if quiz.questions.count() != quiz.total_questions:
        raise ValidationError("Quiz is not fully configured yet.")
    now = timezone.now()
    existing = QuizAttempt.objects.filter(
        user=user, quiz=quiz, completed_at__isnull=True
    ).order_by("-created_at").first()
    if existing:
        if now - existing.started_at <= timedelta(hours=2):
            return existing, False
        existing.completed_at = now
        existing.restart_required = True
        existing.save(update_fields=["completed_at", "restart_required", "updated_at"])

    attempt_number = QuizAttempt.objects.filter(user=user, quiz=quiz).count() + 1
    questions = list(quiz.questions.all())
    if quiz.randomize_questions:
        random.shuffle(questions)
    snapshot = {
        "questions": [question.id for question in questions],
        "options": {},
    }
    for question in questions:
        option_ids = list(question.options.values_list("id", flat=True))
        if quiz.randomize_options:
            random.shuffle(option_ids)
        snapshot["options"][str(question.id)] = option_ids
    attempt = QuizAttempt.objects.create(
        user=user,
        quiz=quiz,
        attempt_number=attempt_number,
        total_questions=len(questions),
        snapshot=snapshot,
    )
    return attempt, True


def attempt_questions(attempt):
    order = attempt.snapshot.get("questions", [])
    questions = {question.id: question for question in attempt.quiz.questions.prefetch_related("options")}
    result = []
    for question_id in order:
        question = questions.get(question_id)
        if not question:
            continue
        option_order = attempt.snapshot.get("options", {}).get(str(question.id), [])
        options = {option.id: option for option in question.options.all()}
        ordered = [options[option_id] for option_id in option_order if option_id in options]
        result.append((question, ordered or list(question.options.all())))
    return result


def evaluate_question(question, selected_options, text_answer):
    if question.type == Question.Type.TEXT:
        accepted = [normalize_text(item) for item in (question.accepted_answers or [])]
        return bool(accepted) and normalize_text(text_answer) in accepted
    correct_ids = set(question.options.filter(is_correct=True).values_list("id", flat=True))
    selected_ids = set()
    for value in selected_options or []:
        try:
            selected_ids.add(int(value))
        except (TypeError, ValueError):
            continue
    return bool(selected_ids) and selected_ids == correct_ids


@transaction.atomic
def submit_attempt(attempt, answers):
    """answers: list of {question_id, selected_options, text_answer}."""
    if attempt.completed_at:
        raise ValidationError("This attempt has already been submitted.")
    quiz = attempt.quiz
    if not can_take_quiz(attempt.user, quiz):
        raise PermissionDenied("You no longer have access to this quiz.")
    question_ids = attempt.snapshot.get("questions", [])
    questions = {question.id: question for question in quiz.questions.filter(pk__in=question_ids)}
    by_question = {}
    for item in answers or []:
        try:
            question_id = int(item.get("question_id"))
        except (TypeError, ValueError):
            continue
        by_question[question_id] = item

    correct_count = 0
    answer_rows = []
    for question_id in question_ids:
        question = questions.get(question_id)
        if not question:
            continue
        submitted = by_question.get(question_id, {})
        selected = submitted.get("selected_options") or []
        text_answer = submitted.get("text_answer") or ""
        is_correct = evaluate_question(question, selected, text_answer)
        if is_correct:
            correct_count += question.points
        answer_rows.append(
            QuizAnswer(
                attempt=attempt,
                question=question,
                selected_options=selected,
                text_answer=text_answer,
                is_correct=is_correct,
                points_awarded=question.points if is_correct else 0,
            )
        )
    QuizAnswer.objects.filter(attempt=attempt).delete()
    QuizAnswer.objects.bulk_create(answer_rows)
    total = len(question_ids)
    wrong_count = total - correct_count
    passed = correct_count >= quiz.passing_score
    attempt.completed_at = timezone.now()
    attempt.correct_count = correct_count
    attempt.wrong_count = wrong_count
    attempt.score = correct_count
    attempt.total_questions = total
    attempt.passed = passed
    attempt.restart_required = not passed and wrong_count >= 4
    attempt.save()
    _after_submit(attempt)
    return attempt


def _after_submit(attempt):
    from apps.notifications.services import notify_user
    from apps.analytics.services import award_points

    quiz = attempt.quiz
    course = quiz.lesson.section.course
    progress = course_progress(attempt.user, course)
    if attempt.passed:
        award_points(
            attempt.user,
            10,
            "quiz_passed",
            reference=f"quiz-attempt:{attempt.id}",
        )
        notify_user(
            attempt.user,
            "quiz_result",
            title_uz="Test muvaffaqiyatli topshirildi",
            title_ru="Тест успешно пройден",
            message_uz=f"{quiz.lesson.title_uz}: {attempt.correct_count}/{attempt.total_questions}. Keyingi dars ochildi.",
            message_ru=f"{quiz.lesson.title_ru}: {attempt.correct_count}/{attempt.total_questions}. Следующий урок открыт.",
            data={"course_slug": course.slug, "lesson_id": quiz.lesson_id, "attempt_id": attempt.id},
            telegram=True,
        )
    else:
        notify_user(
            attempt.user,
            "quiz_result",
            title_uz="Testdan o'tilmadi",
            title_ru="Тест не пройден",
            message_uz=f"{quiz.lesson.title_uz}: {attempt.correct_count}/{attempt.total_questions}. "
            + ("Test avtomatik boshidan boshlanadi." if attempt.restart_required else ""),
            message_ru=f"{quiz.lesson.title_ru}: {attempt.correct_count}/{attempt.total_questions}.",
            data={"course_slug": course.slug, "lesson_id": quiz.lesson_id, "attempt_id": attempt.id},
        )
    if progress["is_complete"]:
        from apps.certificates.services import issue_certificate_if_eligible

        issue_certificate_if_eligible(attempt.user, course)
