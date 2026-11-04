import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from apps.certificates.models import Certificate
from apps.comments.models import Comment
from apps.courses.models import Course, Enrollment, Lesson
from apps.payments.models import Payment
from apps.quizzes.models import QuizAttempt
from apps.subscriptions.models import Subscription
from apps.users.models import User
from .models import ActivityEvent, DailyAnalytics, Leaderboard, PointsTransaction, StudentPoints

logger = logging.getLogger("apps.analytics")


@transaction.atomic
def award_points(user, points, reason, reference="", metadata=None):
    if not user or not user.is_authenticated or points == 0:
        return None
    if reference:
        if PointsTransaction.objects.filter(user=user, reference=reference).exists():
            return None
    balance, _ = StudentPoints.objects.select_for_update().get_or_create(user=user)
    balance.points += points
    balance.save(update_fields=["points", "updated_at"])
    return PointsTransaction.objects.create(
        user=user,
        points=points,
        reason=reason,
        reference=reference,
        metadata=metadata or {},
    )


def record_activity(user, event, metadata=None):
    try:
        ActivityEvent.objects.create(user=user if user and user.is_authenticated else None, event=event, metadata=metadata or {})
    except Exception:
        logger.exception("Failed to record activity")


def compute_leaderboard(period=Leaderboard.Period.ALL):
    now = timezone.now()
    if period == Leaderboard.Period.WEEK:
        since = now - timedelta(days=7)
    elif period == Leaderboard.Period.MONTH:
        since = now - timedelta(days=30)
    else:
        since = None

    users = User.objects.filter(role=User.Role.STUDENT, is_active=True)
    entries = []
    for user in users:
        points_qs = PointsTransaction.objects.filter(user=user)
        if since:
            points_qs = points_qs.filter(created_at__gte=since)
        points = points_qs.aggregate(s=Sum("points"))["s"] or 0
        completed = Enrollment.objects.filter(user=user, completed_at__isnull=False).count()
        attempts = QuizAttempt.objects.filter(user=user, completed_at__isnull=False)
        if since:
            attempts = attempts.filter(created_at__gte=since)
        total_attempts = attempts.count()
        passed = attempts.filter(passed=True).count()
        accuracy = (passed / total_attempts * 100) if total_attempts else 0
        entries.append(
            {
                "user": user,
                "points": points,
                "completed_courses": completed,
                "quiz_accuracy": accuracy,
            }
        )
    entries.sort(key=lambda item: (item["points"], item["completed_courses"], item["quiz_accuracy"]), reverse=True)
    Leaderboard.objects.filter(period=period).delete()
    for index, entry in enumerate(entries, start=1):
        Leaderboard.objects.create(
            user=entry["user"],
            period=period,
            points=entry["points"],
            completed_courses=entry["completed_courses"],
            quiz_accuracy=entry["quiz_accuracy"],
            rank=index,
            calculated_at=now,
        )


def rebuild_daily_analytics(date=None):
    from datetime import datetime

    target = date or timezone.localdate()
    start = timezone.make_aware(datetime.combine(target, datetime.min.time()))
    end = start + timedelta(days=1)
    revenue = (
        Payment.objects.filter(status=Payment.Status.SUCCESS, paid_at__gte=start, paid_at__lt=end)
        .aggregate(s=Sum("amount"))["s"]
        or 0
    )
    new_students = User.objects.filter(role=User.Role.STUDENT, created_at__gte=start, created_at__lt=end).count()
    active_subscriptions = Subscription.objects.filter(status__in=["active", "grace"]).count()
    enrollments = Enrollment.objects.filter(created_at__gte=start, created_at__lt=end).count()
    completions = Enrollment.objects.filter(completed_at__gte=start, completed_at__lt=end).count()
    quiz_attempts = QuizAttempt.objects.filter(created_at__gte=start, created_at__lt=end).count()
    quiz_passes = QuizAttempt.objects.filter(completed_at__gte=start, completed_at__lt=end, passed=True).count()
    new_certificates = Certificate.objects.filter(issued_at__gte=start, issued_at__lt=end).count()
    DailyAnalytics.objects.update_or_create(
        date=target,
        defaults={
            "revenue": revenue,
            "new_students": new_students,
            "active_subscriptions": active_subscriptions,
            "enrollments": enrollments,
            "completions": completions,
            "quiz_attempts": quiz_attempts,
            "quiz_passes": quiz_passes,
            "new_certificates": new_certificates,
        },
    )


def overview_stats():
    users = User.objects
    payments = Payment.objects.filter(status=Payment.Status.SUCCESS)
    return {
        "total_students": users.filter(role=User.Role.STUDENT).count(),
        "active_subscriptions": Subscription.objects.filter(status__in=["active", "grace"]).count(),
        "total_courses": Course.objects.count(),
        "published_courses": Course.objects.filter(status=Course.Status.PUBLISHED).count(),
        "total_revenue": payments.aggregate(s=Sum("amount"))["s"] or 0,
        "monthly_revenue": payments.filter(
            paid_at__gte=timezone.now().replace(day=1)
        ).aggregate(s=Sum("amount"))["s"]
        or 0,
        "failed_payments": Payment.objects.filter(status=Payment.Status.FAILED).count(),
        "pending_payments": Payment.objects.filter(status=Payment.Status.PENDING).count(),
        "certificates_issued": Certificate.objects.count(),
        "comments_pending": Comment.objects.filter(is_deleted=False).count(),
    }
