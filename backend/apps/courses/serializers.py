from django.utils import timezone
from rest_framework import serializers

from apps.users.serializers import UserPublicSerializer
from common.utils import unique_slug
from .models import Category, Course, CourseSection, Discount, Enrollment, Lesson, Video, VideoProgress


def absolute_file(serializer, field):
    if not field:
        return None
    request = serializer.context.get("request")
    try:
        url = field.url
    except ValueError:
        return None
    return request.build_absolute_uri(url) if request else url


class CategorySerializer(serializers.ModelSerializer):
    course_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = [
            "id",
            "name_uz",
            "name_ru",
            "slug",
            "description_uz",
            "description_ru",
            "icon",
            "order",
            "is_active",
            "course_count",
        ]
        read_only_fields = ["slug"]


class TeacherCardSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    avatar = serializers.SerializerMethodField()
    courses_count = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()

    class Meta:
        model = Course._meta.get_field("teacher").related_model
        fields = ["id", "full_name", "avatar", "role", "courses_count", "students_count"]

    def _stats(self, obj):
        cache = self.context.setdefault("_teacher_stats_cache", {})
        if obj.id not in cache:
            cache[obj.id] = {
                "courses_count": obj.taught_courses.filter(
                    status=Course.Status.PUBLISHED
                ).count(),
                "students_count": Enrollment.objects.filter(
                    course__teacher=obj, is_active=True
                )
                .values("user_id")
                .distinct()
                .count(),
            }
        return cache[obj.id]

    def get_courses_count(self, obj):
        return self._stats(obj)["courses_count"]

    def get_students_count(self, obj):
        return self._stats(obj)["students_count"]

    def get_avatar(self, obj):
        return absolute_file(self, obj.avatar)


class DiscountSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title_uz", read_only=True)
    course_title_ru = serializers.CharField(source="course.title_ru", read_only=True)
    is_current = serializers.BooleanField(read_only=True)

    class Meta:
        model = Discount
        fields = [
            "id",
            "course",
            "course_title",
            "course_title_ru",
            "percentage",
            "starts_at",
            "ends_at",
            "is_active",
            "is_current",
            "created_at",
        ]

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "End date must be after start date."})
        request = self.context.get("request")
        course = attrs.get("course", getattr(self.instance, "course", None))
        if request and request.user.role == "teacher" and course and course.teacher_id != request.user.id:
            raise serializers.ValidationError({"course": "You can only discount your own courses."})
        return attrs


class CourseListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    teacher = TeacherCardSerializer(read_only=True)
    thumbnail = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    short_description = serializers.SerializerMethodField()
    discount_percent = serializers.IntegerField(read_only=True)
    old_price = serializers.DecimalField(source="price", max_digits=12, decimal_places=0, read_only=True)
    effective_price = serializers.DecimalField(max_digits=12, decimal_places=0, read_only=True)
    effective_monthly_price = serializers.DecimalField(max_digits=12, decimal_places=0, read_only=True)
    discount_ends_at = serializers.DateTimeField(read_only=True)
    is_enrolled = serializers.SerializerMethodField()
    has_access = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "slug",
            "title",
            "title_uz",
            "title_ru",
            "short_description",
            "short_description_uz",
            "short_description_ru",
            "thumbnail",
            "category",
            "teacher",
            "level",
            "language",
            "status",
            "is_free",
            "price",
            "old_price",
            "monthly_price",
            "effective_price",
            "effective_monthly_price",
            "discount_percent",
            "discount_ends_at",
            "rating_avg",
            "rating_count",
            "students_count",
            "lessons_count",
            "duration_minutes",
            "is_featured",
            "is_enrolled",
            "has_access",
            "progress_percent",
            "published_at",
            "created_at",
        ]

    def _lang(self):
        request = self.context.get("request")
        return request.query_params.get("lang", "uz") if request else "uz"

    def get_title(self, obj):
        return obj.title_ru if self._lang() == "ru" else obj.title_uz

    def get_short_description(self, obj):
        return obj.short_description_ru if self._lang() == "ru" else obj.short_description_uz

    def get_thumbnail(self, obj):
        return absolute_file(self, obj.thumbnail)

    def _request_user(self):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return request.user

    def _enrollment(self, obj):
        user = self._request_user()
        if not user:
            return None
        cache = self.context.setdefault("_enrollment_cache", {})
        if obj.id not in cache:
            cache[obj.id] = Enrollment.objects.filter(user=user, course=obj, is_active=True).first()
        return cache[obj.id]

    def get_is_enrolled(self, obj):
        return self._enrollment(obj) is not None

    def get_has_access(self, obj):
        from apps.courses.services import has_course_access

        return has_course_access(self._request_user(), obj)

    def get_progress_percent(self, obj):
        enrollment = self._enrollment(obj)
        return enrollment.progress_percent if enrollment else 0


class LessonSummarySerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    has_video = serializers.SerializerMethodField()
    quiz = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "title",
            "title_uz",
            "title_ru",
            "order",
            "duration_seconds",
            "is_free_preview",
            "is_completed",
            "is_locked",
            "has_video",
            "quiz",
        ]

    def _lang(self):
        request = self.context.get("request")
        return request.query_params.get("lang", "uz") if request else "uz"

    def get_title(self, obj):
        return obj.title_ru if self._lang() == "ru" else obj.title_uz

    def get_is_completed(self, obj):
        completed_map = self.context.get("completed_map")
        if completed_map is not None and obj.id in completed_map:
            return completed_map[obj.id]
        user = self.context.get("user")
        if not user or not user.is_authenticated:
            return False
        from apps.courses.services import lesson_completed

        return lesson_completed(user, obj)

    def get_is_locked(self, obj):
        if self.context.get("is_staff_view"):
            return False
        locked_map = self.context.get("locked_map")
        if locked_map is not None:
            return locked_map.get(obj.id, True)
        return True

    def get_has_video(self, obj):
        return obj.videos.exists()

    def get_quiz(self, obj):
        quiz = getattr(obj, "quiz", None)
        if not quiz:
            return None
        request = self.context.get("request")
        is_staff = bool(
            request
            and request.user.is_authenticated
            and (request.user.role in {"teacher", "admin"} or request.user.is_superuser)
        )
        if not quiz.is_active and not is_staff:
            return None
        user = self.context.get("user") or (request.user if request and request.user.is_authenticated else None)
        passed = False
        attempts = 0
        if user and user.is_authenticated:
            from apps.quizzes.models import QuizAttempt

            passed = QuizAttempt.objects.filter(user=user, quiz=quiz, passed=True).exists()
            attempts = QuizAttempt.objects.filter(user=user, quiz=quiz).count()
        return {
            "id": quiz.id,
            "title_uz": quiz.title_uz,
            "title_ru": quiz.title_ru,
            "passing_score": quiz.passing_score,
            "total_questions": quiz.total_questions,
            "is_active": quiz.is_active,
            "passed": passed,
            "attempts": attempts,
        }


class SectionSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    lessons = LessonSummarySerializer(many=True, read_only=True)
    lessons_count = serializers.SerializerMethodField()

    class Meta:
        model = CourseSection
        fields = [
            "id",
            "title",
            "title_uz",
            "title_ru",
            "description",
            "order",
            "lessons_count",
            "lessons",
        ]

    def _lang(self):
        request = self.context.get("request")
        return request.query_params.get("lang", "uz") if request else "uz"

    def get_title(self, obj):
        return obj.title_ru if self._lang() == "ru" else obj.title_uz

    def get_lessons_count(self, obj):
        return obj.lessons.count()


class CourseDetailSerializer(CourseListSerializer):
    description = serializers.SerializerMethodField()
    sections = serializers.SerializerMethodField()
    has_access = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    subscription = serializers.SerializerMethodField()
    first_lesson_id = serializers.SerializerMethodField()
    certificate_id = serializers.SerializerMethodField()
    meta_title = serializers.CharField(read_only=True)
    meta_description = serializers.CharField(read_only=True)

    class Meta(CourseListSerializer.Meta):
        fields = CourseListSerializer.Meta.fields + [
            "description",
            "description_uz",
            "description_ru",
            "sections",
            "progress",
            "subscription",
            "first_lesson_id",
            "certificate_id",
            "meta_title",
            "meta_description",
        ]

    def get_description(self, obj):
        return obj.description_ru if self._lang() == "ru" else obj.description_uz

    def get_sections(self, obj):
        sections = obj.sections.prefetch_related("lessons__videos", "lessons__quiz").all()
        user = self._request_user()
        progress = self.context.get("progress") or {}
        completed_map = progress.get("completed_map", {})
        lessons = []
        for section in sections:
            lessons.extend(list(section.lessons.all()))
        from apps.courses.services import is_lesson_unlocked

        locked_map = {}
        if user:
            for lesson in lessons:
                locked_map[lesson.id] = not (
                    lesson.is_free_preview or is_lesson_unlocked(user, obj, lesson, completed_map)
                )
        else:
            locked_map = {lesson.id: not lesson.is_free_preview for lesson in lessons}
        context = {
            **self.context,
            "completed_map": completed_map,
            "locked_map": locked_map,
            "user": user,
        }
        return SectionSerializer(sections, many=True, context=context).data

    def get_has_access(self, obj):
        from apps.courses.services import has_course_access

        return has_course_access(self._request_user(), obj)

    def get_is_enrolled(self, obj):
        return self._enrollment(obj) is not None

    def get_progress(self, obj):
        progress = self.context.get("progress")
        if not progress:
            return None
        data = {
            key: value
            for key, value in progress.items()
            if key not in {"next_lesson", "last_lesson"}
        }
        data["next_lesson_id"] = progress["next_lesson"].id if progress.get("next_lesson") else None
        data["last_lesson_id"] = progress["last_lesson"].id if progress.get("last_lesson") else None
        return data

    def get_subscription(self, obj):
        user = self._request_user()
        if not user:
            return None
        from apps.subscriptions.models import Subscription
        from apps.subscriptions.serializers import SubscriptionSerializer

        subscription = Subscription.objects.filter(user=user, course=obj).first()
        return SubscriptionSerializer(subscription, context=self.context).data if subscription else None

    def get_first_lesson_id(self, obj):
        first = Lesson.objects.filter(section__course=obj).order_by("section__order", "order", "id").first()
        return first.id if first else None

    def get_certificate_id(self, obj):
        user = self._request_user()
        if not user:
            return None
        from apps.certificates.models import Certificate

        certificate = Certificate.objects.filter(user=user, course=obj, revoked=False).first()
        return certificate.certificate_id if certificate else None


class CourseWriteSerializer(serializers.ModelSerializer):
    teacher_id = serializers.IntegerField(required=False, write_only=True)
    category_id = serializers.IntegerField(write_only=True)
    thumbnail = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "slug",
            "title_uz",
            "title_ru",
            "short_description_uz",
            "short_description_ru",
            "description_uz",
            "description_ru",
            "thumbnail",
            "category_id",
            "teacher_id",
            "level",
            "language",
            "is_free",
            "price",
            "monthly_price",
            "is_featured",
            "meta_title",
            "meta_description",
            "status",
        ]
        read_only_fields = ["slug", "status"]
        extra_kwargs = {
            "price": {"required": False},
            "monthly_price": {"required": False},
        }

    def validate(self, attrs):
        request = self.context.get("request")
        category_id = attrs.get("category_id")
        if category_id and not Category.objects.filter(pk=category_id).exists():
            raise serializers.ValidationError({"category_id": "Category not found."})
        is_free = attrs.get("is_free", getattr(self.instance, "is_free", False))
        price = attrs.get("price", getattr(self.instance, "price", 0))
        monthly = attrs.get("monthly_price", getattr(self.instance, "monthly_price", 0))
        if not is_free:
            if not monthly or monthly <= 0:
                raise serializers.ValidationError({"monthly_price": "Paid courses require a monthly price."})
            if price and price < monthly:
                raise serializers.ValidationError({"price": "Full price cannot be lower than the monthly price."})
        if attrs.get("is_free"):
            attrs["price"] = 0
            attrs["monthly_price"] = 0
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        category_id = validated_data.pop("category_id")
        teacher_id = validated_data.pop("teacher_id", None)
        validated_data["category_id"] = category_id
        if request.user.role == "teacher":
            validated_data["teacher"] = request.user
        else:
            from apps.users.models import User

            teacher = User.objects.filter(pk=teacher_id, role=User.Role.TEACHER).first() if teacher_id else User.objects.filter(role=User.Role.TEACHER).first()
            if not teacher:
                raise serializers.ValidationError({"teacher_id": "A teacher account is required."})
            validated_data["teacher"] = teacher
        validated_data.setdefault("status", Course.Status.DRAFT)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context["request"]
        category_id = validated_data.pop("category_id", None)
        validated_data.pop("teacher_id", None)
        if category_id:
            validated_data["category_id"] = category_id
        if request.user.role == "teacher" and instance.teacher_id != request.user.id:
            raise serializers.ValidationError("You can only edit your own courses.")
        return super().update(instance, validated_data)


class SectionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseSection
        fields = ["id", "course", "title_uz", "title_ru", "description", "order"]

    def validate(self, attrs):
        request = self.context.get("request")
        course = attrs.get("course", getattr(self.instance, "course", None))
        if request and request.user.role == "teacher" and course and course.teacher_id != request.user.id:
            raise serializers.ValidationError("You can only manage your own courses.")
        return attrs


class LessonWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = [
            "id",
            "section",
            "title_uz",
            "title_ru",
            "description_uz",
            "description_ru",
            "order",
            "duration_seconds",
            "is_free_preview",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        section = attrs.get("section", getattr(self.instance, "section", None))
        if request and request.user.role == "teacher" and section and section.course.teacher_id != request.user.id:
            raise serializers.ValidationError("You can only manage your own courses.")
        return attrs


class VideoWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = [
            "id",
            "lesson",
            "title",
            "file",
            "hls_url",
            "quality",
            "duration_seconds",
            "is_primary",
            "processing_status",
            "size_bytes",
        ]
        read_only_fields = ["size_bytes"]
        extra_kwargs = {"file": {"required": False}}

    def validate(self, attrs):
        request = self.context.get("request")
        lesson = attrs.get("lesson", getattr(self.instance, "lesson", None))
        if request and request.user.role == "teacher" and lesson and lesson.section.course.teacher_id != request.user.id:
            raise serializers.ValidationError("You can only manage your own courses.")
        file = attrs.get("file", getattr(self.instance, "file", None))
        hls_url = attrs.get("hls_url", getattr(self.instance, "hls_url", ""))
        if not file and not hls_url:
            raise serializers.ValidationError("Upload a video file or provide a protected HLS URL.")
        return attrs


class LessonDetailSerializer(serializers.ModelSerializer):
    """Returned by /lessons/{id}/ only after access checks. Includes signed, expiring video URLs."""

    title = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    videos = serializers.SerializerMethodField()
    quiz = serializers.SerializerMethodField()
    course = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    next_lesson_id = serializers.SerializerMethodField()
    previous_lesson_id = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "title",
            "title_uz",
            "title_ru",
            "description",
            "order",
            "duration_seconds",
            "is_free_preview",
            "videos",
            "quiz",
            "course",
            "progress",
            "next_lesson_id",
            "previous_lesson_id",
            "is_completed",
        ]

    def _lang(self):
        request = self.context.get("request")
        return request.query_params.get("lang", "uz") if request else "uz"

    def get_title(self, obj):
        return obj.title_ru if self._lang() == "ru" else obj.title_uz

    def get_description(self, obj):
        return obj.description_ru if self._lang() == "ru" else obj.description_uz

    def get_videos(self, obj):
        from apps.courses.services import issue_video_token

        request = self.context["request"]
        user = request.user
        result = []
        for video in obj.videos.all():
            token = issue_video_token(user, video)
            url = request.build_absolute_uri(f"/api/videos/{video.id}/stream/") + f"?token={token}"
            result.append(
                {
                    "id": video.id,
                    "quality": video.quality,
                    "duration_seconds": video.duration_seconds,
                    "is_primary": video.is_primary,
                    "stream_url": url,
                }
            )
        return result

    def get_quiz(self, obj):
        quiz = getattr(obj, "quiz", None)
        if not quiz or not quiz.is_active:
            return None
        from apps.quizzes.models import QuizAttempt
        from apps.quizzes.serializers import QuizStudentSerializer

        user = self.context["request"].user
        passed = QuizAttempt.objects.filter(user=user, quiz=quiz, passed=True).exists()
        attempt = QuizAttempt.objects.filter(user=user, quiz=quiz, completed_at__isnull=True).order_by("-created_at").first()
        data = QuizStudentSerializer(quiz, context=self.context).data
        data["passed"] = passed
        data["in_progress_attempt_id"] = attempt.id if attempt else None
        return data

    def get_course(self, obj):
        course = obj.section.course
        return {
            "id": course.id,
            "slug": course.slug,
            "title_uz": course.title_uz,
            "title_ru": course.title_ru,
        }

    def get_progress(self, obj):
        user = self.context["request"].user
        progress = VideoProgress.objects.filter(user=user, lesson=obj).first()
        if not progress:
            return {"watched_seconds": 0, "last_position": 0, "duration": 0, "completed": False}
        return {
            "watched_seconds": progress.watched_seconds,
            "last_position": progress.last_position,
            "duration": progress.duration,
            "completed": progress.completed,
        }

    def _ordered(self, obj):
        return list(
            Lesson.objects.filter(section__course=obj.section.course)
            .order_by("section__order", "section_id", "order", "id")
        )

    def get_next_lesson_id(self, obj):
        lessons = self._ordered(obj)
        for index, lesson in enumerate(lessons):
            if lesson.id == obj.id and index + 1 < len(lessons):
                return lessons[index + 1].id
        return None

    def get_previous_lesson_id(self, obj):
        lessons = self._ordered(obj)
        for index, lesson in enumerate(lessons):
            if lesson.id == obj.id and index > 0:
                return lessons[index - 1].id
        return None

    def get_is_completed(self, obj):
        from apps.courses.services import lesson_completed

        return lesson_completed(self.context["request"].user, obj)


class EnrollmentSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    last_lesson = LessonSummarySerializer(read_only=True)
    next_lesson_id = serializers.SerializerMethodField()
    certificate_id = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "course",
            "progress_percent",
            "last_lesson",
            "next_lesson_id",
            "certificate_id",
            "is_active",
            "completed_at",
            "updated_at",
        ]

    def get_next_lesson_id(self, obj):
        from apps.courses.services import course_progress

        progress = course_progress(obj.user, obj.course, update_cache=False)
        return progress["next_lesson"].id if progress["next_lesson"] else None

    def get_certificate_id(self, obj):
        from apps.certificates.models import Certificate

        certificate = Certificate.objects.filter(user=obj.user, course=obj.course, revoked=False).first()
        return certificate.certificate_id if certificate else None


class ProgressUpdateSerializer(serializers.Serializer):
    lesson_id = serializers.IntegerField()
    video_id = serializers.IntegerField(required=False, allow_null=True)
    watched_seconds = serializers.IntegerField(min_value=0)
    duration = serializers.IntegerField(min_value=0)
    completed = serializers.BooleanField(required=False, default=False)


class CourseProgressSerializer(serializers.Serializer):
    total_lessons = serializers.IntegerField()
    completed_lessons = serializers.IntegerField()
    total_quizzes = serializers.IntegerField()
    completed_quizzes = serializers.IntegerField()
    percent = serializers.IntegerField()
    is_complete = serializers.BooleanField()
    next_lesson_id = serializers.IntegerField(allow_null=True)
    last_lesson_id = serializers.IntegerField(allow_null=True)
