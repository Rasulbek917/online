from django.contrib import admin

from .models import (
    Category,
    Course,
    CourseSection,
    Discount,
    Enrollment,
    Lesson,
    Video,
    VideoProgress,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name_uz", "name_ru", "slug", "order", "is_active")
    list_editable = ("order", "is_active")
    search_fields = ("name_uz", "name_ru")
    prepopulated_fields = {"slug": ("name_uz",)}


class LessonInline(admin.StackedInline):
    model = Lesson
    extra = 0
    show_change_link = True


@admin.register(CourseSection)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("title_uz", "course", "order")
    list_filter = ("course",)
    search_fields = ("title_uz", "course__title_uz")
    inlines = [LessonInline]
    autocomplete_fields = ("course",)


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = (
        "title_uz",
        "teacher",
        "category",
        "status",
        "is_free",
        "monthly_price",
        "students_count",
        "rating_avg",
    )
    list_filter = ("status", "is_free", "is_featured", "level", "category")
    search_fields = ("title_uz", "title_ru", "slug", "teacher__email")
    prepopulated_fields = {"slug": ("title_uz",)}
    autocomplete_fields = ("teacher", "category")
    readonly_fields = ("rating_avg", "rating_count", "students_count", "lessons_count", "duration_minutes")
    date_hierarchy = "created_at"


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title_uz", "section", "order", "duration_seconds", "is_free_preview")
    list_filter = ("section__course", "is_free_preview")
    search_fields = ("title_uz", "section__course__title_uz")
    autocomplete_fields = ("section",)


class VideoProgressInline(admin.TabularInline):
    model = VideoProgress
    extra = 0
    readonly_fields = ("user", "watched_seconds", "duration", "completed", "updated_at")


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ("lesson", "quality", "duration_seconds", "is_primary", "processing_status")
    list_filter = ("quality", "processing_status")
    autocomplete_fields = ("lesson",)
    inlines = [VideoProgressInline]


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("user", "course", "progress_percent", "is_active", "completed_at")
    list_filter = ("is_active", "course")
    search_fields = ("user__email", "course__title_uz")
    autocomplete_fields = ("user", "course")


@admin.register(Discount)
class DiscountAdmin(admin.ModelAdmin):
    list_display = ("course", "percentage", "starts_at", "ends_at", "is_active")
    list_filter = ("is_active",)
    autocomplete_fields = ("course",)
