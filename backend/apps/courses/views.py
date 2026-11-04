import mimetypes
import re
from pathlib import Path

from django.conf import settings
from django.db import models
from django.http import Http404, HttpResponse, HttpResponseForbidden
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.services import record_activity
from apps.certificates.services import issue_certificate_if_eligible
from common.permissions import IsAdminRole, IsTeacherOrAdmin
from common.utils import get_client_ip
from .models import Category, Course, CourseSection, Discount, Enrollment, Lesson, Video, VideoProgress
from .serializers import (
    CategorySerializer,
    CourseDetailSerializer,
    CourseListSerializer,
    CourseProgressSerializer,
    CourseWriteSerializer,
    DiscountSerializer,
    EnrollmentSerializer,
    LessonDetailSerializer,
    LessonSummarySerializer,
    LessonWriteSerializer,
    ProgressUpdateSerializer,
    SectionSerializer,
    SectionWriteSerializer,
    VideoWriteSerializer,
)
from .services import (
    course_progress,
    get_or_create_enrollment,
    has_course_access,
    is_lesson_unlocked,
    issue_video_token,
    mark_video_progress,
    ordered_lessons,
    parse_video_token,
    refresh_course_stats,
    resolve_video_access,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.annotate(course_count=models.Count("courses", filter=models.Q(courses__status=Course.Status.PUBLISHED), distinct=True))
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["order", "name_uz"]
    ordering = ["order", "name_uz"]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAdminRole()]
        return [AllowAny()]


class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseListSerializer
    lookup_field = "slug"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title_uz", "title_ru", "short_description_uz", "short_description_ru"]
    ordering_fields = ["created_at", "rating_avg", "students_count", "price", "monthly_price", "published_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        qs = Course.objects.select_related("teacher", "category").prefetch_related(
            "sections__lessons__videos", "sections__lessons__quiz"
        )
        is_staff = user.is_authenticated and (user.role in {"teacher", "admin"} or user.is_superuser)
        if self.action == "list":
            if not is_staff:
                qs = qs.filter(status=Course.Status.PUBLISHED)
        elif self.action == "retrieve":
            if not is_staff:
                qs = qs.filter(status=Course.Status.PUBLISHED)
            elif user.role == "teacher":
                from django.db.models import Q

                qs = qs.filter(Q(status=Course.Status.PUBLISHED) | Q(teacher=user))
        if user.is_authenticated and user.role == "teacher":
            if self.action in {"create", "update", "partial_update", "destroy", "publish", "unpublish"}:
                return qs.filter(teacher=user)
        return qs

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        params = self.request.query_params
        category = params.get("category")
        if category:
            queryset = queryset.filter(category__slug=category)
        level = params.get("level")
        if level:
            queryset = queryset.filter(level=level)
        if params.get("free") in {"1", "true", "True"}:
            queryset = queryset.filter(is_free=True)
        if params.get("discounted") in {"1", "true", "True"}:
            now = timezone.now()
            queryset = queryset.filter(
                discounts__is_active=True,
                discounts__starts_at__lte=now,
                discounts__ends_at__gte=now,
            ).distinct()
        price_min = params.get("price_min")
        price_max = params.get("price_max")
        try:
            if price_min:
                queryset = queryset.filter(monthly_price__gte=price_min)
            if price_max:
                queryset = queryset.filter(monthly_price__lte=price_max)
        except (TypeError, ValueError):
            pass
        ordering = params.get("ordering")
        if ordering == "popular":
            queryset = queryset.order_by("-students_count", "-rating_avg")
        elif ordering == "newest":
            queryset = queryset.order_by("-published_at", "-created_at")
        elif ordering == "rating":
            queryset = queryset.order_by("-rating_avg")
        elif ordering == "price_low":
            queryset = queryset.order_by("monthly_price")
        elif ordering == "price_high":
            queryset = queryset.order_by("-monthly_price")
        return queryset

    def get_serializer_class(self):
        user = self.request.user
        if self.action == "retrieve":
            return CourseDetailSerializer
        if self.action in {"create", "update", "partial_update"} and user.is_authenticated and (user.role in {"teacher", "admin"} or user.is_superuser):
            return CourseWriteSerializer
        return CourseListSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "publish", "unpublish"}:
            return [IsTeacherOrAdmin()]
        if self.action in {"mine", "enroll", "progress", "learn"}:
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["progress"] = None
        course = getattr(self, "object", None)
        user = self.request.user
        if course and user.is_authenticated and course.status == Course.Status.PUBLISHED:
            if has_course_access(user, course) or course.is_free:
                context["progress"] = course_progress(user, course)
        return context

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self.object = instance
        serializer = self.get_serializer(instance, context=self.get_serializer_context())
        if request.user.is_authenticated:
            if instance.is_free or has_course_access(request.user, instance):
                get_or_create_enrollment(request.user, instance)
            record_activity(request.user, "course_view", {"course_id": instance.id})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsTeacherOrAdmin])
    def publish(self, request, slug=None):
        course = self.get_object()
        if course.teacher_id != request.user.id and request.user.role != "admin":
            raise PermissionDenied("Only the course teacher or admin can publish.")
        if not course.sections.exists() or not Lesson.objects.filter(section__course=course).exists():
            raise ValidationError({"detail": "Add at least one section and one lesson before publishing."})
        if course.is_free:
            if course.monthly_price or course.price:
                course.monthly_price = 0
                course.price = 0
                course.save(update_fields=["monthly_price", "price"])
        else:
            if not course.monthly_price:
                raise ValidationError({"detail": "Set a monthly price for paid courses."})
        course.status = Course.Status.PUBLISHED
        course.published_at = timezone.now()
        course.save(update_fields=["status", "published_at", "updated_at"])
        refresh_course_stats(course)
        return Response(CourseDetailSerializer(course, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsTeacherOrAdmin])
    def unpublish(self, request, slug=None):
        course = self.get_object()
        if course.teacher_id != request.user.id and request.user.role != "admin":
            raise PermissionDenied("Only the course teacher or admin can unpublish.")
        course.status = Course.Status.DRAFT
        course.save(update_fields=["status", "updated_at"])
        return Response(CourseDetailSerializer(course, context={"request": request}).data)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mine(self, request):
        if request.user.role == "teacher":
            qs = Course.objects.filter(teacher=request.user).select_related("teacher", "category")
        elif request.user.role in {"admin", "superuser"}:
            qs = Course.objects.all().select_related("teacher", "category")
        else:
            enrollments = Enrollment.objects.filter(user=request.user, is_active=True).values_list("course_id", flat=True)
            qs = Course.objects.filter(id__in=enrollments).select_related("teacher", "category")
        page = self.paginate_queryset(qs)
        serializer = CourseListSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=["get"])
    def featured(self, request):
        qs = self.get_queryset().filter(is_featured=True, status=Course.Status.PUBLISHED)[:10]
        serializer = CourseListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def popular(self, request):
        qs = self.get_queryset().order_by("-students_count", "-rating_avg")[:12]
        serializer = CourseListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def new(self, request):
        qs = self.get_queryset().order_by("-published_at", "-created_at")[:12]
        serializer = CourseListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def enroll(self, request, slug=None):
        course = self.get_object()
        if not course.is_free:
            if not has_course_access(request.user, course):
                return Response(
                    {
                        "error": {
                            "code": "payment_required",
                            "message": "An active subscription is required to enroll in this course.",
                        }
                    },
                    status=status.HTTP_402_PAYMENT_REQUIRED,
                )
        enrollment = get_or_create_enrollment(request.user, course)
        return Response(
            EnrollmentSerializer(enrollment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def progress(self, request, slug=None):
        course = self.get_object()
        if not has_course_access(request.user, course) and not course.is_free:
            raise PermissionDenied("You do not have access to this course.")
        result = course_progress(request.user, course)
        data = {
            "total_lessons": result["total_lessons"],
            "completed_lessons": result["completed_lessons"],
            "total_quizzes": result["total_quizzes"],
            "completed_quizzes": result["completed_quizzes"],
            "percent": result["percent"],
            "is_complete": result["is_complete"],
            "next_lesson_id": result["next_lesson"].id if result["next_lesson"] else None,
            "last_lesson_id": result["last_lesson"].id if result["last_lesson"] else None,
        }
        return Response(CourseProgressSerializer(data).data)

    @action(detail=True, methods=["get"])
    def learn(self, request, slug=None):
        course = self.get_object()
        from apps.courses.services import has_course_access

        if not has_course_access(request.user, course) and not course.is_free:
            raise PermissionDenied("Subscribe to this course to continue learning.")
        progress = course_progress(request.user, course)
        enrollment = get_or_create_enrollment(request.user, course)
        lesson = progress["next_lesson"] or progress["last_lesson"]
        if not lesson:
            lessons = ordered_lessons(course)
            lesson = lessons[0] if lessons else None
        if not lesson:
            raise ValidationError("This course has no lessons yet.")
        if not is_lesson_unlocked(request.user, course, lesson, progress.get("completed_map", {})):
            lessons = ordered_lessons(course)
            for candidate in lessons:
                if is_lesson_unlocked(request.user, course, candidate, progress.get("completed_map", {})):
                    lesson = candidate
                    break
        return Response({"course_slug": course.slug, "lesson_id": lesson.id})


class LessonViewSet(viewsets.ModelViewSet):
    serializer_class = LessonWriteSerializer
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ["section"]

    def get_queryset(self):
        user = self.request.user
        qs = Lesson.objects.select_related("section", "section__course", "quiz").prefetch_related("videos")
        if user.role == "teacher":
            return qs.filter(section__course__teacher=user)
        return qs

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def student(self, request, pk=None):
        lesson = Lesson.objects.select_related(
            "section", "section__course", "quiz"
        ).prefetch_related("videos", "quiz__questions").get(pk=pk)
        course = lesson.section.course
        if not (lesson.is_free_preview or has_course_access(request.user, course)):
            raise PermissionDenied("You do not have access to this lesson.")
        if not lesson.is_free_preview and not is_lesson_unlocked(request.user, course, lesson):
            raise PermissionDenied("Complete previous lessons to unlock this lesson.")
        context = {"request": request}
        serializer = LessonDetailSerializer(lesson, context=context)
        get_or_create_enrollment(request.user, course)
        enrollment = Enrollment.objects.filter(user=request.user, course=course).first()
        if enrollment:
            enrollment.last_lesson = lesson
            enrollment.save(update_fields=["last_lesson", "updated_at"])
        record_activity(request.user, "lesson_view", {"course_id": course.id, "lesson_id": lesson.id})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def progress(self, request, pk=None):
        serializer = ProgressUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lesson = Lesson.objects.select_related("section", "section__course").get(pk=pk)
        video = Video.objects.filter(pk=serializer.validated_data.get("video_id"), lesson=lesson).first() if serializer.validated_data.get("video_id") else None
        progress = mark_video_progress(
            request.user,
            lesson,
            video,
            serializer.validated_data["watched_seconds"],
            serializer.validated_data["duration"],
            serializer.validated_data.get("completed", False),
        )
        course = lesson.section.course
        course_prog = course_progress(request.user, course)
        issue_certificate_if_eligible(request.user, course)
        return Response(
            {
                "progress": {
                    "watched_seconds": progress.watched_seconds,
                    "last_position": progress.last_position,
                    "duration": progress.duration,
                    "completed": progress.completed,
                },
                "course_progress": CourseProgressSerializer(
                    {
                        "total_lessons": course_prog["total_lessons"],
                        "completed_lessons": course_prog["completed_lessons"],
                        "total_quizzes": course_prog["total_quizzes"],
                        "completed_quizzes": course_prog["completed_quizzes"],
                        "percent": course_prog["percent"],
                        "is_complete": course_prog["is_complete"],
                        "next_lesson_id": course_prog["next_lesson"].id if course_prog["next_lesson"] else None,
                        "last_lesson_id": course_prog["last_lesson"].id if course_prog["last_lesson"] else None,
                    }
                ).data,
            }
        )


class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionWriteSerializer
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ["course"]

    def get_queryset(self):
        user = self.request.user
        qs = CourseSection.objects.select_related("course")
        if user.role == "teacher":
            return qs.filter(course__teacher=user)
        return qs


class VideoViewSet(viewsets.ModelViewSet):
    serializer_class = VideoWriteSerializer
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ["lesson"]

    def get_queryset(self):
        user = self.request.user
        qs = Video.objects.select_related("lesson", "lesson__section", "lesson__section__course")
        if user.role == "teacher":
            return qs.filter(lesson__section__course__teacher=user)
        return qs


class VideoStreamView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        video = Video.objects.select_related("lesson", "lesson__section", "lesson__section__course").filter(pk=pk).first()
        if not video:
            raise Http404("Video not found")
        token = request.query_params.get("token") or request.headers.get("X-Video-Token")
        if not token:
            return HttpResponseForbidden("Missing video token.")
        try:
            payload = parse_video_token(token)
        except ValidationError:
            return HttpResponseForbidden("Invalid or expired video token.")
        if int(payload.get("video_id")) != int(video.id):
            return HttpResponseForbidden("Token does not match this video.")
        from apps.users.models import User

        user = User.objects.filter(pk=payload.get("user_id"), is_active=True).first()
        if not user:
            return HttpResponseForbidden("Unauthorized user.")
        try:
            resolve_video_access(user, video)
        except (PermissionDenied, ValidationError) as exc:
            return HttpResponseForbidden(str(getattr(exc, "detail", "Access denied")))
        if not video.file:
            return HttpResponseForbidden("Video source not available.")
        path = Path(video.file.path)
        if not path.exists():
            raise Http404("Video file missing")
        content_type, _ = mimetypes.guess_type(str(path))
        if not content_type or not content_type.startswith("video/"):
            content_type = "video/mp4"
        size = path.stat().st_size
        range_header = request.headers.get("Range")
        start, end = 0, size - 1
        partial = False
        if range_header:
            match = re.match(r"bytes=(\d*)-(\d*)", range_header)
            if match:
                if match.group(1):
                    start = int(match.group(1))
                if match.group(2):
                    end = min(int(match.group(2)), size - 1)
                if start > end or start >= size:
                    response = HttpResponse(status=416)
                    response["Content-Range"] = f"bytes */{size}"
                    return response
                partial = True
        length = end - start + 1

        def file_iterator(path, start, length, chunk_size=1024 * 256):
            with open(path, "rb") as handle:
                handle.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = handle.read(min(chunk_size, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        from django.http import StreamingHttpResponse

        response = StreamingHttpResponse(
            file_iterator(path, start, length),
            status=206 if partial else 200,
            content_type=content_type,
        )
        response["Content-Length"] = str(length)
        if partial:
            response["Content-Range"] = f"bytes {start}-{end}/{size}"
        response["Accept-Ranges"] = "bytes"
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response["Cross-Origin-Resource-Policy"] = "cross-origin"
        response["Content-Disposition"] = "inline"
        return response


class DiscountViewSet(viewsets.ModelViewSet):
    serializer_class = DiscountSerializer
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ["course", "is_active"]

    def get_queryset(self):
        user = self.request.user
        qs = Discount.objects.select_related("course", "course__teacher")
        if user.role == "teacher":
            return qs.filter(course__teacher=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class EnrollmentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Enrollment.objects.filter(user=user, is_active=True).select_related(
            "course", "course__category", "course__teacher", "last_lesson"
        )
        return qs


class ProgressViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def create(self, request):
        serializer = ProgressUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        lesson = Lesson.objects.select_related("section", "section__course").filter(pk=data["lesson_id"]).first()
        if not lesson:
            raise ValidationError({"lesson_id": "Lesson not found."})
        video = Video.objects.filter(pk=data.get("video_id"), lesson=lesson).first() if data.get("video_id") else None
        progress = mark_video_progress(
            request.user,
            lesson,
            video,
            data["watched_seconds"],
            data["duration"],
            data.get("completed", False),
        )
        course = lesson.section.course
        course_prog = course_progress(request.user, course)
        return Response(
            {
                "progress": {
                    "lesson_id": lesson.id,
                    "watched_seconds": progress.watched_seconds,
                    "last_position": progress.last_position,
                    "duration": progress.duration,
                    "completed": progress.completed,
                },
                "course_progress": {
                    "percent": course_prog["percent"],
                    "completed_lessons": course_prog["completed_lessons"],
                    "total_lessons": course_prog["total_lessons"],
                    "is_complete": course_prog["is_complete"],
                    "next_lesson_id": course_prog["next_lesson"].id if course_prog["next_lesson"] else None,
                },
            }
        )

    @action(detail=False, methods=["get"], url_path="continue-learning")
    def continue_learning(self, request):
        enrollments = (
            Enrollment.objects.filter(user=request.user, is_active=True)
            .select_related("course", "course__category", "course__teacher", "last_lesson")
            .order_by("-updated_at")[:12]
        )
        items = []
        for enrollment in enrollments:
            course = enrollment.course
            progress = course_progress(request.user, course, update_cache=False)
            lesson = progress["next_lesson"] or progress["last_lesson"] or progress["last_lesson"]
            if lesson is None:
                lessons = ordered_lessons(course)
                lesson = lessons[0] if lessons else None
            if not lesson:
                continue
            from apps.subscriptions.models import Subscription

            subscription = Subscription.objects.filter(user=request.user, course=course).first()
            if not course.is_free and not has_course_access(request.user, course):
                lesson_url = None
            else:
                lesson_url = f"/learn/{course.slug}/{lesson.id}"
            items.append(
                {
                    "course": CourseListSerializer(course, context={"request": request}).data,
                    "lesson_id": lesson.id,
                    "lesson_title_uz": lesson.title_uz,
                    "lesson_title_ru": lesson.title_ru,
                    "percent": progress["percent"],
                    "is_complete": progress["is_complete"],
                    "last_position": VideoProgress.objects.filter(
                        user=request.user, lesson=lesson
                    ).values_list("last_position", flat=True).first() or 0,
                    "lesson_url": lesson_url,
                    "subscription_status": subscription.status if subscription else None,
                    "access_active": has_course_access(request.user, course),
                }
            )
        return Response({"results": items})

    @action(detail=False, methods=["get"], url_path=r"course/(?P<slug>[^/.]+)")
    def course(self, request, slug=None):
        course = Course.objects.filter(slug=slug).first()
        if not course:
            raise ValidationError({"course": "Course not found."})
        if not course.is_free and not has_course_access(request.user, course):
            raise PermissionDenied("You do not have access to this course.")
        result = course_progress(request.user, course)
        return Response(
            {
                "course_slug": course.slug,
                "total_lessons": result["total_lessons"],
                "completed_lessons": result["completed_lessons"],
                "total_quizzes": result["total_quizzes"],
                "completed_quizzes": result["completed_quizzes"],
                "percent": result["percent"],
                "is_complete": result["is_complete"],
                "next_lesson_id": result["next_lesson"].id if result["next_lesson"] else None,
                "last_lesson_id": result["last_lesson"].id if result["last_lesson"] else None,
            }
        )


class PublicLearningView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Course.objects.filter(status=Course.Status.PUBLISHED, is_free=True).select_related("teacher", "category")[:6]
        return Response(CourseListSerializer(qs, many=True, context={"request": request}).data)
