from django.contrib import admin

from .models import AnswerOption, Question, Quiz, QuizAnswer, QuizAttempt


class AnswerOptionInline(admin.TabularInline):
    model = AnswerOption
    extra = 0


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("text_uz", "quiz", "type", "order", "points")
    list_filter = ("type", "quiz")
    inlines = [AnswerOptionInline]
    search_fields = ("text_uz", "text_ru")


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0
    show_change_link = True


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ("title_uz", "lesson", "passing_score", "total_questions", "is_active")
    list_filter = ("is_active",)
    search_fields = ("title_uz", "lesson__title_uz")
    inlines = [QuestionInline]


class QuizAnswerInline(admin.TabularInline):
    model = QuizAnswer
    extra = 0
    readonly_fields = ("question", "selected_options", "text_answer", "is_correct", "points_awarded")


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ("user", "quiz", "correct_count", "total_questions", "passed", "restart_required", "created_at")
    list_filter = ("passed", "restart_required", "quiz")
    search_fields = ("user__email", "quiz__title_uz")
    inlines = [QuizAnswerInline]


@admin.register(AnswerOption)
class AnswerOptionAdmin(admin.ModelAdmin):
    list_display = ("text_uz", "question", "is_correct", "order")
    list_filter = ("is_correct",)
