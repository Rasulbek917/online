from datetime import datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.db import connection
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.certificates.models import Certificate
from apps.certificates.serializers import CertificateSerializer
from apps.comments.models import Comment
from apps.courses.models import Category, Course, Enrollment, Lesson
from apps.courses.serializers import CourseListSerializer, EnrollmentSerializer, TeacherCardSerializer
from apps.payments.models import Payment
from apps.payments.serializers import PaymentAdminSerializer
from apps.payments.services import enabled_providers
from apps.quizzes.models import QuizAttempt
from apps.quizzes.serializers import QuizAttemptSerializer
from apps.subscriptions.models import Subscription
from apps.users.models import User
from apps.users.serializers import UserAdminSerializer
from common.permissions import IsAdminRole, IsTeacherOrAdmin
from .models import AuditLog, Leaderboard, StudentPoints, SystemSettings, Testimonial
from .serializers import (
    AdminSettingsSerializer,
    AuditLogSerializer,
    LeaderboardEntrySerializer,
    PublicSettingsSerializer,
    TestimonialSerializer,
)
from .services import overview_stats


def resolve_range(value):
    now = timezone.now()
    if value == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now, TruncDate
    mapping = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = mapping.get(value, 30)
    start = now - timedelta(days=days)
    return start, now, TruncMonth if value == "1y" else TruncDate


def series_rows(queryset, date_field, value_field, trunc, start, end):
    rows = (
        queryset.filter(**{f"{date_field}__gte": start, f"{date_field}__lte": end})
        .exclude(**{f"{date_field}__isnull": True})
        .annotate(bucket=trunc(date_field))
        .values("bucket")
        .annotate(total=Sum(value_field) if value_field else Count("id"))
        .order_by("bucket")
    )
    return {row["bucket"]: row["total"] for row in rows}


def build_series(range_key, course_filter=None, course_ids=None):
    start, end, trunc = resolve_range(range_key)
    payments = Payment.objects.filter(status=Payment.Status.SUCCESS)
    enrollments = Enrollment.objects.all()
    users = User.objects.filter(role=User.Role.STUDENT)
    if course_filter is not None:
        payments = payments.filter(course=course_filter)
        enrollments = enrollments.filter(course=course_filter)
    elif course_ids is not None:
        payments = payments.filter(course_id__in=course_ids)
        enrollments = enrollments.filter(course_id__in=course_ids)
    revenue = series_rows(payments, "paid_at", "amount", trunc, start, end)
    enrollments_map = series_rows(enrollments, "created_at", None, trunc, start, end)
    students = series_rows(users, "created_at", None, trunc, start, end)

    buckets = []
    if trunc is TruncMonth:
        cursor = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        while cursor <= end:
            buckets.append(cursor.date())
            cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
    else:
        cursor = start.replace(hour=0, minute=0, second=0, microsecond=0)
        while cursor.date() <= end.date():
            buckets.append(cursor.date())
            cursor += timedelta(days=1)

    data = []
    for bucket in buckets:
        key_date = bucket
        label = bucket.strftime("%Y-%m") if trunc is TruncMonth else bucket.strftime("%d.%m")
        data.append(
            {
                "date": label,
                "revenue": float(revenue.get(key_date, Decimal("0")) or 0),
                "enrollments": int(enrollments_map.get(key_date, 0) or 0),
                "new_students": int(students.get(key_date, 0) or 0),
            }
        )
    return data


class HealthCheckView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        checks = {"database": False, "cache": False}
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                checks["database"] = cursor.fetchone()[0] == 1
        except Exception:
            checks["database"] = False
        try:
            from django.core.cache import cache

            cache.set("health-check", "ok", 10)
            checks["cache"] = cache.get("health-check") == "ok"
        except Exception:
            checks["cache"] = False
        healthy = checks["database"]
        return Response(
            {"status": "ok" if healthy else "degraded", "checks": checks, "time": timezone.now()},
            status=200 if healthy else 503,
        )


health_check = HealthCheckView.as_view()


class PublicStatsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        courses = Course.objects.filter(status=Course.Status.PUBLISHED)
        rating = courses.aggregate(avg=Avg("rating_avg"))["avg"] or 0
        return Response(
            {
                "students": User.objects.filter(role=User.Role.STUDENT, is_active=True).count(),
                "courses": courses.count(),
                "lessons": Lesson.objects.filter(section__course__status=Course.Status.PUBLISHED).count(),
                "certificates": Certificate.objects.filter(revoked=False).count(),
                "categories": Category.objects.filter(is_active=True).count(),
                "average_rating": round(float(rating), 1),
            }
        )


public_stats = PublicStatsView.as_view()


class TestimonialListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        qs = Testimonial.objects.filter(is_approved=True)[:8]
        return Response(TestimonialSerializer(qs, many=True, context={"request": request}).data)


public_testimonials = TestimonialListView.as_view()


class StudentDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        enrollments = (
            Enrollment.objects.filter(user=user, is_active=True)
            .select_related("course", "course__category", "course__teacher", "last_lesson")
            .order_by("-updated_at")
        )
        completed = enrollments.filter(completed_at__isnull=False).count()
        total = enrollments.count()
        balance = StudentPoints.objects.filter(user=user).first()
        points = balance.points if balance else 0
        rank = StudentPoints.objects.filter(points__gt=points).count() + 1 if balance else None
        certificates = Certificate.objects.filter(user=user, revoked=False).select_related(
            "course", "course__teacher", "course__category"
        )[:6]
        quiz_attempts = QuizAttempt.objects.filter(user=user).select_related(
            "quiz", "quiz__lesson", "quiz__lesson__section__course"
        )[:6]
        payments = Payment.objects.filter(user=user).select_related(
            "course", "course__category", "course__teacher"
        )[:6]
        from apps.notifications.models import Notification

        return Response(
            {
                "summary": {
                    "enrolled_courses": total,
                    "completed_courses": completed,
                    "in_progress_courses": total - completed,
                    "certificates": Certificate.objects.filter(user=user, revoked=False).count(),
                    "points": points,
                    "rank": rank,
                    "unread_notifications": Notification.objects.filter(user=user, is_read=False).count(),
                },
                "enrollments": EnrollmentSerializer(
                    enrollments[:6], many=True, context={"request": request}
                ).data,
                "certificates": CertificateSerializer(
                    certificates, many=True, context={"request": request}
                ).data,
                "quiz_attempts": QuizAttemptSerializer(
                    quiz_attempts, many=True, context={"request": request}
                ).data,
                "payments": PaymentAdminSerializer(
                    payments, many=True, context={"request": request}
                ).data,
            }
        )


class TeacherAnalyticsView(APIView):
    permission_classes = [IsTeacherOrAdmin]

    def get(self, request):
        user = request.user
        courses = Course.objects.all() if user.role == "admin" else Course.objects.filter(teacher=user)
        course_ids = list(courses.values_list("id", flat=True))
        enrollments = Enrollment.objects.filter(course_id__in=course_ids)
        payments = Payment.objects.filter(course_id__in=course_ids, status=Payment.Status.SUCCESS)
        attempts = QuizAttempt.objects.filter(
            quiz__lesson__section__course_id__in=course_ids, completed_at__isnull=False
        )
        total_attempts = attempts.count()
        passed = attempts.filter(passed=True).count()
        range_key = request.query_params.get("range", "30d")
        start, end, _ = resolve_range(range_key)
        revenue_in_range = payments.filter(paid_at__gte=start).aggregate(s=Sum("amount"))["s"] or 0
        course_performance = []
        for course in courses.select_related("category")[:20]:
            course_enrollments = enrollments.filter(course=course)
            course_payments = payments.filter(course=course)
            course_performance.append(
                {
                    "course": CourseListSerializer(course, context={"request": request}).data,
                    "students": course_enrollments.count(),
                    "completed": course_enrollments.filter(completed_at__isnull=False).count(),
                    "revenue": float(course_payments.aggregate(s=Sum("amount"))["s"] or 0),
                    "avg_progress": round(
                        course_enrollments.aggregate(avg=Avg("progress_percent"))["avg"] or 0, 1
                    ),
                }
            )
        return Response(
            {
                "summary": {
                    "courses": courses.count(),
                    "published_courses": courses.filter(status=Course.Status.PUBLISHED).count(),
                    "students": enrollments.values("user_id").distinct().count(),
                    "revenue": float(payments.aggregate(s=Sum("amount"))["s"] or 0),
                    "revenue_in_range": float(revenue_in_range),
                    "completion_rate": round(
                        (enrollments.filter(completed_at__isnull=False).count() / enrollments.count() * 100)
                        if enrollments.count()
                        else 0,
                        1,
                    ),
                    "quiz_success_rate": round((passed / total_attempts * 100) if total_attempts else 0, 1),
                },
                "series": build_series(range_key, course_ids=course_ids),
                "courses": course_performance,
                "recent_payments": PaymentAdminSerializer(
                    payments.select_related("course", "course__category", "course__teacher", "user")[:8],
                    many=True,
                    context={"request": request},
                ).data,
            }
        )


class AdminAnalyticsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        range_key = request.query_params.get("range", "30d")
        stats = overview_stats()
        provider_rows = (
            Payment.objects.filter(status=Payment.Status.SUCCESS)
            .values("provider")
            .annotate(count=Count("id"), total=Sum("amount"))
            .order_by("-total")
        )
        top_courses = (
            Course.objects.filter(status=Course.Status.PUBLISHED)
            .order_by("-students_count", "-rating_avg")
            .select_related("teacher", "category")[:6]
        )
        recent_payments = Payment.objects.select_related(
            "user", "course", "course__teacher", "course__category"
        )[:8]
        recent_users = (
            User.objects.order_by("-created_at")
            .annotate(
                courses_count=Count("taught_courses", distinct=True),
                enrollments_count=Count("enrollments", distinct=True),
            )[:8]
        )
        enrollments = Enrollment.objects.all()
        attempts = QuizAttempt.objects.filter(completed_at__isnull=False)
        total_attempts = attempts.count()
        return Response(
            {
                "summary": {
                    **stats,
                    "total_revenue": float(stats["total_revenue"]),
                    "monthly_revenue": float(stats["monthly_revenue"]),
                    "completion_rate": round(
                        (enrollments.filter(completed_at__isnull=False).count() / enrollments.count() * 100)
                        if enrollments.count()
                        else 0,
                        1,
                    ),
                    "quiz_success_rate": round(
                        (attempts.filter(passed=True).count() / total_attempts * 100) if total_attempts else 0,
                        1,
                    ),
                },
                "series": build_series(range_key),
                "providers": [
                    {"provider": row["provider"], "count": row["count"], "total": float(row["total"] or 0)}
                    for row in provider_rows
                ],
                "top_courses": CourseListSerializer(
                    top_courses, many=True, context={"request": request}
                ).data,
                "recent_payments": PaymentAdminSerializer(
                    recent_payments, many=True, context={"request": request}
                ).data,
                "recent_users": UserAdminSerializer(recent_users, many=True).data,
            }
        )


class RevenueAnalyticsView(APIView):
    permission_classes = [IsTeacherOrAdmin]

    def get(self, request):
        range_key = request.query_params.get("range", "30d")
        start, end, _ = resolve_range(range_key)
        payments = Payment.objects.filter(status=Payment.Status.SUCCESS)
        if request.user.role == "teacher":
            payments = payments.filter(course__teacher=request.user)
        totals = payments.aggregate(total=Sum("amount"), count=Count("id"))
        return Response(
            {
                "range": range_key,
                "total": float(totals["total"] or 0),
                "transactions": totals["count"] or 0,
                "in_range": float(
                    payments.filter(paid_at__gte=start).aggregate(s=Sum("amount"))["s"] or 0
                ),
                "series": build_series(
                    range_key,
                    course_ids=list(payments.values_list("course_id", flat=True).distinct()),
                ),
            }
        )


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        leaderboard_type = request.query_params.get("type", "overall")
        period = request.query_params.get("period", "all")
        if period not in {"all", "month", "week"}:
            period = "all"
        since = None
        now = timezone.now()
        if period == "week":
            since = now - timedelta(days=7)
        elif period == "month":
            since = now - timedelta(days=30)

        users = list(User.objects.filter(role=User.Role.STUDENT, is_active=True))
        entries = []
        for user in users:
            point_qs = user.points_transactions.all()
            if since:
                point_qs = point_qs.filter(created_at__gte=since)
            points = point_qs.aggregate(s=Sum("points"))["s"] or 0
            completed_qs = Enrollment.objects.filter(user=user, completed_at__isnull=False)
            if since:
                completed_qs = completed_qs.filter(completed_at__gte=since)
            completed = completed_qs.count()
            attempts = QuizAttempt.objects.filter(user=user, completed_at__isnull=False)
            if since:
                attempts = attempts.filter(created_at__gte=since)
            total_attempts = attempts.count()
            passed_attempts = attempts.filter(passed=True).count()
            accuracy = round((passed_attempts / total_attempts * 100) if total_attempts else 0, 1)
            score = float(points) + completed * 100 + passed_attempts * 10 + accuracy
            entries.append(
                {
                    "user": user,
                    "points": points,
                    "completed_courses": completed,
                    "quiz_accuracy": accuracy,
                    "score": round(score, 1),
                }
            )
        sort_keys = {
            "points": lambda item: (item["points"], item["completed_courses"], item["quiz_accuracy"]),
            "courses": lambda item: (item["completed_courses"], item["points"], item["quiz_accuracy"]),
            "quizzes": lambda item: (item["quiz_accuracy"], item["points"], item["completed_courses"]),
            "overall": lambda item: (item["score"], item["points"], item["completed_courses"]),
        }
        entries.sort(key=sort_keys.get(leaderboard_type, sort_keys["overall"]), reverse=True)
        results = []
        me = None
        for index, entry in enumerate(entries, start=1):
            serialized = {
                **entry,
                "rank": index,
                "is_me": entry["user"].id == request.user.id,
            }
            if index <= 50:
                results.append(serialized)
            if entry["user"].id == request.user.id:
                me = serialized
        data = LeaderboardEntrySerializer(results, many=True, context={"request": request}).data
        return Response(
            {
                "type": leaderboard_type,
                "period": period,
                "results": data,
                "me": LeaderboardEntrySerializer(me, context={"request": request}).data if me else None,
                "total_students": len(entries),
            }
        )


class SettingsView(APIView):
    def get_permissions(self):
        return [IsAdminRole()] if self.request.method in {"PATCH", "PUT"} else [AllowAny()]

    def get(self, request):
        settings_obj = SystemSettings.load()
        user = request.user
        if user.is_authenticated and (user.role == "admin" or user.is_superuser):
            data = dict(AdminSettingsSerializer(settings_obj).data)
        else:
            data = dict(PublicSettingsSerializer(settings_obj).data)
        provider_flags = {
            "click": getattr(settings_obj, "click_enabled", True),
            "payme": getattr(settings_obj, "payme_enabled", True),
            "uzum": getattr(settings_obj, "uzum_enabled", True),
            "humo": getattr(settings_obj, "humo_enabled", True),
            "uzcard": getattr(settings_obj, "uzcard_enabled", True),
            "google_pay": getattr(settings_obj, "google_pay_enabled", True),
            "apple_pay": getattr(settings_obj, "apple_pay_enabled", True),
        }
        data["payment_providers"] = [
            provider
            for provider in enabled_providers()
            if provider_flags.get(provider["id"], True)
        ]
        data["google_client_id"] = settings.GOOGLE_CLIENT_ID or ""
        return Response(data)

    def patch(self, request):
        settings_obj = SystemSettings.load()
        serializer = AdminSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AdminSettingsSerializer(settings_obj).data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminRole]
    queryset = AuditLog.objects.select_related("user")
    serializer_class = AuditLogSerializer
    filterset_fields = ["action", "user"]
    search_fields = ["action", "model_name", "object_id", "user__email"]


class CategoryListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        from apps.courses.serializers import CategorySerializer

        qs = Category.objects.filter(is_active=True).annotate(
            count=Count("courses", filter=Q(courses__status=Course.Status.PUBLISHED))
        )
        data = []
        for category in qs:
            item = CategorySerializer(category).data
            item["course_count"] = category.count
            data.append(item)
        return Response(data)
