from django.core import signing
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Course, Enrollment, Lesson, Video, VideoProgress

VIDEO_TOKEN_SALT = "itpark.video.stream"
VIDEO_TOKEN_MAX_AGE = 7200


def ordered_lessons(course):
    return list(
        Lesson.objects.filter(section__course=course)
        .select_related("section")
        .order_by("section__order", "section_id", "order", "id")
    )


def get_enrollment(user, course):
    if not user or not user.is_authenticated:
        return None
    return Enrollment.objects.filter(user=user, course=course, is_active=True).first()


def has_course_access(user, course):
    if not user or not user.is_authenticated:
        return False
    if user.is_authenticated and (user.role in {"admin", "teacher"} or user.is_superuser):
        if user.role == "admin" or user.is_superuser:
            return True
        if course.teacher_id == user.id:
            return True
    if course.is_free:
        return Enrollment.objects.filter(user=user, course=course, is_active=True).exists()
    from apps.subscriptions.models import active_subscription

    return active_subscription(user, course) is not None


def has_preview_access(lesson):
    return bool(lesson.is_free_preview)


def lesson_completed(user, lesson, quiz_passed=None):
    from apps.quizzes.models import Quiz, QuizAttempt

    has_video = lesson.videos.exists()
    video_done = VideoProgress.objects.filter(
        user=user, lesson=lesson, completed=True
    ).exists()
    if has_video and not video_done:
        return False
    quiz = Quiz.objects.filter(lesson=lesson, is_active=True).first()
    if quiz is not None:
        if quiz_passed is None:
            quiz_passed = QuizAttempt.objects.filter(
                user=user, quiz=quiz, passed=True
            ).exists()
        if not quiz_passed:
            return False
    if not has_video and quiz is None:
        return False
    return True


def is_lesson_unlocked(user, course, lesson, completed_map=None):
    if not user or not user.is_authenticated:
        return False
    if user.role == "admin" or user.is_superuser or course.teacher_id == user.id:
        return True
    if not has_course_access(user, course):
        return False
    lessons = ordered_lessons(course)
    index = next((i for i, item in enumerate(lessons) if item.id == lesson.id), None)
    if index is None:
        return False
    if index == 0:
        return True
    if completed_map is None:
        completed_map = {}
    previous = lessons[:index]
    for item in previous:
        if item.id in completed_map:
            complete = completed_map[item.id]
        else:
            complete = lesson_completed(user, item)
            completed_map[item.id] = complete
        if not complete:
            return False
    return True


def course_progress(user, course, update_cache=True, auto_issue=True):
    from apps.quizzes.models import Quiz, QuizAttempt

    lessons = ordered_lessons(course)
    if not lessons:
        return {
            "total_lessons": 0,
            "completed_lessons": 0,
            "total_quizzes": 0,
            "completed_quizzes": 0,
            "percent": 0,
            "is_complete": False,
            "next_lesson": None,
            "last_lesson": None,
        }

    lesson_ids = [lesson.id for lesson in lessons]
    completed_video_ids = set(
        VideoProgress.objects.filter(user=user, lesson_id__in=lesson_ids, completed=True)
        .values_list("lesson_id", flat=True)
    )
    quizzes = {
        quiz.lesson_id: quiz
        for quiz in Quiz.objects.filter(lesson_id__in=lesson_ids, is_active=True).select_related("lesson")
    }
    passed_quiz_lesson_ids = set(
        QuizAttempt.objects.filter(
            user=user,
            quiz__lesson_id__in=lesson_ids,
            quiz__is_active=True,
            passed=True,
        ).values_list("quiz__lesson_id", flat=True)
    )
    completed_count = 0
    completed_quizzes = 0
    completed_map = {}
    next_lesson = None
    for lesson in lessons:
        has_video = bool(lesson.videos.exists())
        quiz = quizzes.get(lesson.id)
        complete = (completed_video_ids.__contains__(lesson.id) if has_video else True) and (
            (quiz is not None and lesson.id in passed_quiz_lesson_ids) if quiz else True
        )
        if not has_video and not quiz:
            complete = lesson.id in completed_video_ids
        completed_map[lesson.id] = complete
        if complete:
            completed_count += 1
            if quiz:
                completed_quizzes += 1
        elif next_lesson is None:
            next_lesson = lesson

    percent = round((completed_count / len(lessons)) * 100)
    is_complete = completed_count == len(lessons)
    enrollment = get_enrollment(user, course)
    last_lesson = enrollment.last_lesson if enrollment else None
    if enrollment and (enrollment.progress_percent != percent or (is_complete and not enrollment.completed_at)):
        enrollment.progress_percent = percent
        if is_complete:
            enrollment.completed_at = timezone.now()
        enrollment.save(update_fields=["progress_percent", "completed_at", "updated_at"])

    if is_complete and auto_issue:
        from apps.certificates.services import issue_certificate_if_eligible

        try:
            issue_certificate_if_eligible(user, course)
        except Exception:
            import logging

            logging.getLogger("apps.certificates").exception(
                "Certificate auto-issue failed for user=%s course=%s", user.id, course.id
            )

    return {
        "total_lessons": len(lessons),
        "completed_lessons": completed_count,
        "total_quizzes": len(quizzes),
        "completed_quizzes": completed_quizzes,
        "percent": percent,
        "is_complete": is_complete,
        "next_lesson": next_lesson,
        "last_lesson": last_lesson,
        "completed_map": completed_map,
    }


def get_or_create_enrollment(user, course):
    enrollment, created = Enrollment.objects.get_or_create(user=user, course=course)
    if created:
        refresh_course_stats(course)
    return enrollment


def refresh_course_stats(course):
    lessons = Lesson.objects.filter(section__course=course)
    totals = lessons.aggregate(seconds=Sum("duration_seconds"), count=models_count())
    course.lessons_count = totals["count"] or 0
    course.duration_minutes = int((totals["seconds"] or 0) / 60)
    course.students_count = Enrollment.objects.filter(course=course, is_active=True).count()
    course.save(update_fields=["lessons_count", "duration_minutes", "students_count", "updated_at"])


def models_count():
    from django.db.models import Count

    return Count("id")


def issue_video_token(user, video):
    return signing.dumps(
        {"video_id": video.id, "user_id": user.id},
        salt=VIDEO_TOKEN_SALT,
    )


def parse_video_token(token, max_age=VIDEO_TOKEN_MAX_AGE):
    try:
        return signing.loads(token, salt=VIDEO_TOKEN_SALT, max_age=max_age)
    except signing.BadSignature as exc:
        raise ValidationError({"token": "Video link is invalid or has expired."}) from exc


def resolve_video_access(user, video):
    lesson = video.lesson
    course = lesson.section.course
    if not (has_preview_access(lesson) or has_course_access(user, course)):
        raise PermissionDenied("You do not have access to this lesson.")
    if not has_preview_access(lesson):
        completed_map = {}
        if not is_lesson_unlocked(user, course, lesson, completed_map):
            raise PermissionDenied("Complete the previous lessons and quiz to unlock this lesson.")
    return course


def mark_video_progress(user, lesson, video, watched_seconds, duration, completed=False):
    if watched_seconds < 0 or duration < 0:
        raise ValidationError("Progress values cannot be negative.")
    course = lesson.section.course
    if not (has_preview_access(lesson) or has_course_access(user, course)):
        raise PermissionDenied("You do not have access to this lesson.")
    if not has_preview_access(lesson) and not is_lesson_unlocked(user, course, lesson):
        raise PermissionDenied("This lesson is locked.")
    if duration and watched_seconds > duration * 1.1:
        watched_seconds = duration
    progress, _ = VideoProgress.objects.get_or_create(user=user, lesson=lesson)
    progress.video = video or progress.video
    progress.duration = duration or progress.duration or (video.duration_seconds if video else 0)
    progress.watched_seconds = max(progress.watched_seconds, int(watched_seconds))
    progress.last_position = int(watched_seconds)
    threshold = progress.duration * 0.9 if progress.duration else 0
    if completed or (threshold and progress.watched_seconds >= threshold):
        progress.completed = True
        if not progress.completed_at:
            progress.completed_at = timezone.now()
    progress.save()
    enrollment = get_or_create_enrollment(user, course)
    enrollment.last_lesson = lesson
    enrollment.save(update_fields=["last_lesson", "updated_at"])
    if progress.completed and lesson.duration_seconds:
        lesson.duration_seconds = max(lesson.duration_seconds, progress.duration)
        lesson.save(update_fields=["duration_seconds"])
    return progress
