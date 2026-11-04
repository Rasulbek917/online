from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from common.models import TimeStampedModel


class Quiz(TimeStampedModel):
    lesson = models.OneToOneField(
        "courses.Lesson", on_delete=models.CASCADE, related_name="quiz"
    )
    title_uz = models.CharField(max_length=180)
    title_ru = models.CharField(max_length=180)
    description_uz = models.TextField(blank=True)
    description_ru = models.TextField(blank=True)
    passing_score = models.PositiveSmallIntegerField(default=settings.CERTIFICATE_PASS_SCORE)
    total_questions = models.PositiveSmallIntegerField(default=settings.QUIZ_QUESTIONS_PER_QUIZ)
    randomize_questions = models.BooleanField(default=True)
    randomize_options = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["lesson__section__order", "lesson__order"]

    def __str__(self):
        return self.title_uz

    def clean(self):
        if self.passing_score > self.total_questions:
            raise ValidationError("Passing score cannot exceed total questions.")

    @property
    def questions_count(self):
        return self.questions.count()

    def has_question_count(self):
        return self.questions.count() == self.total_questions


class Question(TimeStampedModel):
    class Type(models.TextChoices):
        SINGLE = "single", "Single choice"
        MULTIPLE = "multiple", "Multiple choice"
        IMAGE = "image", "Image question"
        TEXT = "text", "Text answer"

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    type = models.CharField(max_length=10, choices=Type.choices, default=Type.SINGLE)
    text_uz = models.TextField()
    text_ru = models.TextField()
    image = models.ImageField(upload_to="quizzes/images/%Y/%m/", blank=True, null=True)
    explanation_uz = models.TextField(blank=True)
    explanation_ru = models.TextField(blank=True)
    accepted_answers = models.JSONField(default=list, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    points = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text_uz[:80]

    def clean(self):
        if self.type == self.Type.TEXT and not self.accepted_answers:
            raise ValidationError({"accepted_answers": "Text questions require at least one accepted answer."})
        if self.type != self.Type.TEXT and not self.pk and not self.options.exists():
            # Options may be created after the question in nested writes.
            pass


class AnswerOption(TimeStampedModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
    text_uz = models.CharField(max_length=500)
    text_ru = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text_uz[:60]


class QuizAttempt(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quiz_attempts"
    )
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    attempt_number = models.PositiveIntegerField(default=1)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveSmallIntegerField(default=0)
    total_questions = models.PositiveSmallIntegerField(default=0)
    correct_count = models.PositiveSmallIntegerField(default=0)
    wrong_count = models.PositiveSmallIntegerField(default=0)
    passed = models.BooleanField(default=False, db_index=True)
    restart_required = models.BooleanField(default=False)
    snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "quiz", "passed"]),
            models.Index(fields=["quiz", "passed"]),
        ]

    def __str__(self):
        return f"{self.user} / {self.quiz} / {self.score}/{self.total_questions}"

    @property
    def is_completed(self):
        return self.completed_at is not None


class QuizAnswer(TimeStampedModel):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="quiz_answers")
    selected_options = models.JSONField(default=list, blank=True)
    text_answer = models.TextField(blank=True)
    is_correct = models.BooleanField(default=False)
    points_awarded = models.PositiveSmallIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["attempt", "question"], name="unique_answer_per_attempt")
        ]

    def __str__(self):
        return f"Answer {self.question_id} ({'correct' if self.is_correct else 'wrong'})"
