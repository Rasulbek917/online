from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from common.models import TimeStampedModel
from common.utils import unique_slug


class Category(TimeStampedModel):
    name_uz = models.CharField(max_length=80)
    name_ru = models.CharField(max_length=80)
    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    description_uz = models.CharField(max_length=255, blank=True)
    description_ru = models.CharField(max_length=255, blank=True)
    icon = models.CharField(max_length=40, blank=True, default="code")
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["order", "name_uz"]
        verbose_name_plural = "Categories"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name_uz)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name_uz


class Course(TimeStampedModel):
    class Level(models.TextChoices):
        BEGINNER = "beginner", _("Beginner")
        INTERMEDIATE = "intermediate", _("Intermediate")
        ADVANCED = "advanced", _("Advanced")

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        PUBLISHED = "published", _("Published")
        ARCHIVED = "archived", _("Archived")

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="taught_courses",
    )
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="courses")
    title_uz = models.CharField(max_length=180)
    title_ru = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True, db_index=True)
    short_description_uz = models.CharField(max_length=300, blank=True)
    short_description_ru = models.CharField(max_length=300, blank=True)
    description_uz = models.TextField(blank=True)
    description_ru = models.TextField(blank=True)
    thumbnail = models.ImageField(upload_to="courses/thumbnails/%Y/%m/", blank=True, null=True)
    level = models.CharField(max_length=16, choices=Level.choices, default=Level.BEGINNER)
    language = models.CharField(max_length=2, choices=[("uz", "Uzbek"), ("ru", "Russian")], default="uz")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True)
    is_free = models.BooleanField(default=False, db_index=True)
    price = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal("0"))
    monthly_price = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal("0"))
    is_featured = models.BooleanField(default=False, db_index=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0"))
    rating_count = models.PositiveIntegerField(default=0)
    students_count = models.PositiveIntegerField(default=0)
    lessons_count = models.PositiveIntegerField(default=0)
    duration_minutes = models.PositiveIntegerField(default=0)
    published_at = models.DateTimeField(blank=True, null=True)
    meta_title = models.CharField(max_length=180, blank=True)
    meta_description = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "is_free"]),
            models.Index(fields=["status", "category"]),
            models.Index(fields=["teacher", "status"]),
            models.Index(fields=["is_featured", "status"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title_uz)
        if self.status == self.Status.PUBLISHED and not self.published_at:
            self.published_at = timezone.now()
        if self.is_free:
            self.price = Decimal("0")
            self.monthly_price = Decimal("0")
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title_uz

    @property
    def active_discount(self):
        now = timezone.now()
        return self.discounts.filter(
            is_active=True, starts_at__lte=now, ends_at__gte=now
        ).order_by("-percentage").first()

    @property
    def discount_percent(self):
        discount = self.active_discount
        return discount.percentage if discount else 0

    @property
    def discount_ends_at(self):
        discount = self.active_discount
        return discount.ends_at if discount else None

    @property
    def effective_price(self):
        discount = self.active_discount
        if not discount:
            return self.price
        value = self.price * (Decimal("100") - discount.percentage) / Decimal("100")
        return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)

    @property
    def effective_monthly_price(self):
        discount = self.active_discount
        if not discount:
            return self.monthly_price
        value = self.monthly_price * (Decimal("100") - discount.percentage) / Decimal("100")
        return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)

    @property
    def total_lessons(self):
        return Lesson.objects.filter(section__course=self).count()


class Discount(TimeStampedModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="discounts")
    percentage = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(90)]
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_discounts",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["course", "is_active", "starts_at", "ends_at"])]

    def clean(self):
        if self.ends_at <= self.starts_at:
            raise ValidationError({"ends_at": "End date must be after start date."})
        overlapping = Discount.objects.filter(
            course=self.course,
            is_active=True,
            starts_at__lt=self.ends_at,
            ends_at__gt=self.starts_at,
        ).exclude(pk=self.pk)
        if overlapping.exists():
            raise ValidationError("An active discount already overlaps this period.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def is_current(self):
        now = timezone.now()
        return self.is_active and self.starts_at <= now <= self.ends_at

    def __str__(self):
        return f"{self.course} -{self.percentage}%"


class CourseSection(TimeStampedModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="sections")
    title_uz = models.CharField(max_length=160)
    title_ru = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["course", "order"], name="unique_section_order_per_course")
        ]

    def __str__(self):
        return f"{self.course.title_uz} / {self.title_uz}"


class Lesson(TimeStampedModel):
    section = models.ForeignKey(CourseSection, on_delete=models.CASCADE, related_name="lessons")
    title_uz = models.CharField(max_length=180)
    title_ru = models.CharField(max_length=180)
    description_uz = models.TextField(blank=True)
    description_ru = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(default=0)
    is_free_preview = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["section", "order"], name="unique_lesson_order_per_section")
        ]
        indexes = [models.Index(fields=["section", "order"])]

    def __str__(self):
        return f"{self.section.course.title_uz} / {self.title_uz}"

    @property
    def course(self):
        return self.section.course


class Video(TimeStampedModel):
    class Quality(models.TextChoices):
        Q360 = "360p", "360p"
        Q480 = "480p", "480p"
        Q720 = "720p", "720p"
        Q1080 = "1080p", "1080p"
        AUTO = "auto", "Auto"

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="videos")
    title = models.CharField(max_length=180, blank=True)
    file = models.FileField(upload_to="protected/videos/%Y/%m/", blank=True, null=True)
    hls_url = models.URLField(blank=True)
    quality = models.CharField(max_length=10, choices=Quality.choices, default=Quality.AUTO)
    duration_seconds = models.PositiveIntegerField(default=0)
    size_bytes = models.BigIntegerField(default=0)
    is_primary = models.BooleanField(default=True)
    processing_status = models.CharField(
        max_length=16,
        choices=[("ready", "Ready"), ("processing", "Processing"), ("failed", "Failed")],
        default="ready",
    )

    class Meta:
        ordering = ["-is_primary", "quality"]
        constraints = [
            models.UniqueConstraint(fields=["lesson", "quality"], name="unique_quality_per_lesson")
        ]

    def __str__(self):
        return f"Video for {self.lesson_id} ({self.quality})"

    def save(self, *args, **kwargs):
        if self.file:
            try:
                self.size_bytes = self.file.size
            except (OSError, ValueError):
                pass
        super().save(*args, **kwargs)


class VideoProgress(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="video_progress")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="progress_records")
    video = models.ForeignKey(Video, on_delete=models.SET_NULL, null=True, blank=True)
    watched_seconds = models.PositiveIntegerField(default=0)
    last_position = models.PositiveIntegerField(default=0)
    duration = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False, db_index=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "lesson"], name="unique_video_progress_per_user_lesson")
        ]
        indexes = [models.Index(fields=["user", "completed"])]

    @property
    def percent(self):
        if not self.duration:
            return 0
        return min(100, int((self.watched_seconds / self.duration) * 100))


class Enrollment(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    last_lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True, blank=True)
    progress_percent = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="unique_enrollment_per_user_course")
        ]
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "is_active"])]

    def __str__(self):
        return f"{self.user} -> {self.course}"
