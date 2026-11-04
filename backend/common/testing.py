"""Shared factories used by the automated test suite."""

from __future__ import annotations

from decimal import Decimal

from django.core.files.base import ContentFile
from django.utils import timezone

from apps.courses.models import Category, Course, CourseSection, Lesson, Video, VideoProgress
from apps.quizzes.models import AnswerOption, Question, Quiz, QuizAttempt
from apps.users.models import User


def create_user(email, role=User.Role.STUDENT, password="StrongPass123!", **extra):
    if role == User.Role.ADMIN:
        user = User.objects.create_superuser(email=email, password=password, **extra)
    else:
        user = User.objects.create_user(email=email, password=password, role=role, **extra)
    user.is_email_verified = True
    user.email_verified_at = timezone.now()
    user.save(update_fields=["is_email_verified", "email_verified_at"])
    return user


def create_category(name="Test Category", slug="test-category"):
    return Category.objects.create(name_uz=name, name_ru=name, slug=slug)


def create_course(
    teacher,
    category=None,
    *,
    slug="test-course",
    title="Test Course",
    is_free=False,
    price=1_000_000,
    monthly_price=100_000,
):
    category = category or create_category()
    return Course.objects.create(
        teacher=teacher,
        category=category,
        title_uz=title,
        title_ru=title,
        slug=slug,
        short_description_uz="Test course",
        short_description_ru="Тестовый курс",
        description_uz="Test course description",
        description_ru="Описание тестового курса",
        level=Course.Level.BEGINNER,
        status=Course.Status.PUBLISHED,
        is_free=is_free,
        price=Decimal(price),
        monthly_price=Decimal(monthly_price),
    )


def create_section(course, order=0, title=None):
    return CourseSection.objects.create(
        course=course,
        title_uz=title or f"Section {order + 1}",
        title_ru=title or f"Раздел {order + 1}",
        order=order,
    )


def create_lesson(course, order=0, section=None, title=None, preview=False, with_video=True):
    section = section or create_section(course, order=0)
    lesson = Lesson.objects.create(
        section=section,
        title_uz=title or f"Lesson {order + 1}",
        title_ru=title or f"Урок {order + 1}",
        description_uz="Lesson description",
        description_ru="Описание урока",
        order=order,
        duration_seconds=60,
        is_free_preview=preview,
    )
    if with_video:
        video = Video(
            lesson=lesson,
            title=lesson.title_uz,
            quality=Video.Quality.Q720,
            duration_seconds=60,
            is_primary=True,
        )
        video.file.save(
            f"lesson-{lesson.id}.mp4",
            ContentFile(b"\x00\x00\x00\x18ftypmp42" + b"0" * 256),
            save=True,
        )
    return lesson


def create_quiz(lesson, question_count=10, passing_score=7):
    quiz = Quiz.objects.create(
        lesson=lesson,
        title_uz=f"{lesson.title_uz} quiz",
        title_ru=f"{lesson.title_ru} тест",
        passing_score=passing_score,
        total_questions=question_count,
        randomize_questions=True,
        randomize_options=True,
    )
    for index in range(question_count):
        question = Question.objects.create(
            quiz=quiz,
            type=Question.Type.SINGLE,
            text_uz=f"Question {index + 1}: what is the answer?",
            text_ru=f"Вопрос {index + 1}: какой ответ?",
            explanation_uz="Because it is correct.",
            explanation_ru="Потому что это правильно.",
            order=index,
            points=1,
        )
        for option_index in range(4):
            AnswerOption.objects.create(
                question=question,
                text_uz=f"Option {option_index + 1}",
                text_ru=f"Вариант {option_index + 1}",
                is_correct=option_index == 0,
                order=option_index,
            )
    return quiz


def complete_video(user, lesson, seconds=60):
    progress, _ = VideoProgress.objects.get_or_create(user=user, lesson=lesson)
    progress.watched_seconds = seconds
    progress.last_position = seconds
    progress.duration = seconds
    progress.completed = True
    progress.completed_at = timezone.now()
    progress.save()
    return progress


def complete_lesson(user, lesson, passed=True):
    complete_video(user, lesson)
    quiz = getattr(lesson, "quiz", None)
    if quiz is not None:
        quiz = Quiz.objects.filter(lesson=lesson).first()
        if quiz:
            QuizAttempt.objects.create(
                user=user,
                quiz=quiz,
                attempt_number=QuizAttempt.objects.filter(user=user, quiz=quiz).count() + 1,
                started_at=timezone.now(),
                completed_at=timezone.now(),
                score=10 if passed else 0,
                total_questions=quiz.total_questions,
                correct_count=10 if passed else 0,
                wrong_count=0 if passed else quiz.total_questions,
                passed=passed,
                snapshot={
                    "questions": list(quiz.questions.values_list("id", flat=True)),
                    "options": {},
                },
            )


def answers_for(attempt, correct_count):
    questions = {
        question.id: question
        for question in attempt.quiz.questions.prefetch_related("options")
    }
    answers = []
    for index, question_id in enumerate(attempt.snapshot.get("questions", [])):
        question = questions[question_id]
        correct = list(question.options.filter(is_correct=True).values_list("id", flat=True))
        wrong = list(question.options.filter(is_correct=False).values_list("id", flat=True))
        selected = correct if index < correct_count else wrong[:1]
        answers.append(
            {
                "question_id": question_id,
                "selected_options": selected,
                "text_answer": "",
            }
        )
    return answers


def force_login(client, user):
    from rest_framework_simplejwt.tokens import RefreshToken

    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return token
