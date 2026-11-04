import base64
import binascii
import os
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone
from PIL import Image
from rest_framework import serializers

from apps.users.serializers import UserPublicSerializer
from .models import AnswerOption, Question, Quiz, QuizAnswer, QuizAttempt


def absolute_image(serializer, image):
    if not image:
        return None
    request = serializer.context.get("request")
    return request.build_absolute_uri(image.url) if request else image.url


def image_from_base64(value):
    if not value:
        return None
    extension = "png"
    payload = value
    if value.startswith("data:"):
        header, _, payload = value.partition(",")
        mime = header[5:].split(";")[0]
        extension = (mime.split("/")[-1] or "png").replace("jpeg", "jpg")
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise serializers.ValidationError("Image data is not valid base64.")
    if len(raw) > 5 * 1024 * 1024:
        raise serializers.ValidationError("Question image must be smaller than 5 MB.")
    try:
        Image.open(BytesIO(raw)).verify()
    except Exception:
        raise serializers.ValidationError("Question image is not a valid image file.")
    return ContentFile(raw, name=f"question.{extension}")


def image_from_url(value):
    if not value:
        return None
    path = urlparse(value).path
    media_url = "/media/"
    if media_url in path:
        relative = path.split(media_url, 1)[1]
    else:
        # Object storage URLs put the key in the path (optionally after the bucket).
        relative = path.lstrip("/")
        bucket = os.getenv("AWS_STORAGE_BUCKET_NAME", "")
        if bucket and relative.startswith(f"{bucket}/"):
            relative = relative[len(bucket) + 1 :]
    if not relative or ".." in Path(relative).parts:
        raise serializers.ValidationError("Existing image URL is not a media file.")
    try:
        if not default_storage.exists(relative):
            raise FileNotFoundError(relative)
        if default_storage.size(relative) > 5 * 1024 * 1024:
            raise serializers.ValidationError("Question image must be smaller than 5 MB.")
        with default_storage.open(relative, "rb") as handle:
            content = handle.read()
    except serializers.ValidationError:
        raise
    except Exception:
        raise serializers.ValidationError("Existing image could not be found.")
    return ContentFile(content, name=Path(relative).name)


class AnswerOptionPublicSerializer(serializers.ModelSerializer):
    text = serializers.SerializerMethodField()

    class Meta:
        model = AnswerOption
        fields = ["id", "text"]

    def get_text(self, obj):
        request = self.context.get("request")
        lang = request.query_params.get("lang", "uz") if request else "uz"
        return obj.text_ru if lang == "ru" else obj.text_uz


class QuestionPublicSerializer(serializers.ModelSerializer):
    text = serializers.SerializerMethodField()
    options = AnswerOptionPublicSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ["id", "type", "text", "image", "options", "points"]

    def get_text(self, obj):
        request = self.context.get("request")
        lang = request.query_params.get("lang", "uz") if request else "uz"
        return obj.text_ru if lang == "ru" else obj.text_uz

    def get_image(self, obj):
        return absolute_image(self, obj.image)


class AttemptQuestionSerializer(serializers.Serializer):
    question = QuestionPublicSerializer()
    options = AnswerOptionPublicSerializer(many=True)

    def to_representation(self, instance):
        question, options = instance
        return {
            "id": question.id,
            "type": question.type,
            "text": (question.text_ru if self._lang == "ru" else question.text_uz),
            "image": absolute_image(self, question.image),
            "points": question.points,
            "options": AnswerOptionPublicSerializer(options, many=True, context=self.context).data,
        }

    @property
    def _lang(self):
        request = self.context.get("request")
        return request.query_params.get("lang", "uz") if request else "uz"


class QuizStudentSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    attempts_count = serializers.SerializerMethodField()
    best_score = serializers.SerializerMethodField()
    passed = serializers.SerializerMethodField()
    in_progress_attempt_id = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            "id",
            "title",
            "description",
            "passing_score",
            "total_questions",
            "attempts_count",
            "best_score",
            "passed",
            "in_progress_attempt_id",
            "is_active",
        ]

    def _lang(self):
        request = self.context.get("request")
        return request.query_params.get("lang", "uz") if request else "uz"

    def get_title(self, obj):
        return obj.title_ru if self._lang() == "ru" else obj.title_uz

    def get_description(self, obj):
        return obj.description_ru if self._lang() == "ru" else obj.description_uz

    def _attempts(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return QuizAttempt.objects.none()
        return QuizAttempt.objects.filter(user=request.user, quiz=obj)

    def get_attempts_count(self, obj):
        return self._attempts(obj).count()

    def get_best_score(self, obj):
        return self._attempts(obj).order_by("-correct_count").values_list("correct_count", flat=True).first() or 0

    def get_passed(self, obj):
        return self._attempts(obj).filter(passed=True).exists()

    def get_in_progress_attempt_id(self, obj):
        attempt = self._attempts(obj).filter(completed_at__isnull=True).order_by("-created_at").first()
        return attempt.id if attempt else None


class QuizAttemptSerializer(serializers.ModelSerializer):
    quiz = QuizStudentSerializer(read_only=True)
    user = UserPublicSerializer(read_only=True)
    lesson_id = serializers.IntegerField(source="quiz.lesson_id", read_only=True)
    course_slug = serializers.CharField(source="quiz.lesson.section.course.slug", read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            "id",
            "quiz",
            "user",
            "lesson_id",
            "course_slug",
            "attempt_number",
            "started_at",
            "completed_at",
            "score",
            "total_questions",
            "correct_count",
            "wrong_count",
            "passed",
            "restart_required",
        ]


class QuizAnswerResultSerializer(serializers.ModelSerializer):
    question_id = serializers.IntegerField(read_only=True)
    correct_option_ids = serializers.SerializerMethodField()
    explanation = serializers.SerializerMethodField()

    class Meta:
        model = QuizAnswer
        fields = [
            "question_id",
            "selected_options",
            "text_answer",
            "is_correct",
            "points_awarded",
            "correct_option_ids",
            "explanation",
        ]

    def get_correct_option_ids(self, obj):
        return list(obj.question.options.filter(is_correct=True).values_list("id", flat=True))

    def get_explanation(self, obj):
        request = self.context.get("request")
        lang = request.query_params.get("lang", "uz") if request else "uz"
        return obj.question.explanation_ru if lang == "ru" else obj.question.explanation_uz


class QuizAttemptDetailSerializer(QuizAttemptSerializer):
    answers = QuizAnswerResultSerializer(many=True, read_only=True)

    class Meta(QuizAttemptSerializer.Meta):
        fields = QuizAttemptSerializer.Meta.fields + ["answers"]


# ---------------------------------------------------------------------------
# Teacher / admin management
# ---------------------------------------------------------------------------
class OptionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ["id", "text_uz", "text_ru", "is_correct", "order"]


class QuestionWriteSerializer(serializers.ModelSerializer):
    options = OptionWriteSerializer(many=True, required=False)
    image_base64 = serializers.CharField(required=False, allow_blank=True, write_only=True)
    image_url = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "type",
            "text_uz",
            "text_ru",
            "image",
            "image_base64",
            "image_url",
            "explanation_uz",
            "explanation_ru",
            "accepted_answers",
            "order",
            "points",
            "options",
        ]

    def validate(self, attrs):
        question_type = attrs.get("type", getattr(self.instance, "type", Question.Type.SINGLE))
        options = attrs.get("options")
        if question_type == Question.Type.TEXT:
            accepted = attrs.get("accepted_answers", getattr(self.instance, "accepted_answers", []))
            if not accepted:
                raise serializers.ValidationError({"accepted_answers": "Add at least one accepted answer."})
            return attrs
        if question_type == Question.Type.IMAGE:
            image = attrs.get("image", getattr(self.instance, "image", None))
            if not image and not attrs.get("image_base64") and not attrs.get("image_url"):
                raise serializers.ValidationError({"image": "Image is required for image questions."})
        if options is not None:
            correct = [option for option in options if option.get("is_correct")]
            if len(options) < 2:
                raise serializers.ValidationError({"options": "At least two options are required."})
            if question_type == Question.Type.SINGLE and len(correct) != 1:
                raise serializers.ValidationError({"options": "Single-choice questions need exactly one correct option."})
            if question_type == Question.Type.MULTIPLE and len(correct) < 1:
                raise serializers.ValidationError({"options": "Select at least one correct option."})
        return attrs

    def create(self, validated_data):
        options = validated_data.pop("options", [])
        image_base64 = validated_data.pop("image_base64", "")
        image_url = validated_data.pop("image_url", "")
        if image_base64:
            validated_data["image"] = image_from_base64(image_base64)
        elif image_url:
            validated_data["image"] = image_from_url(image_url)
        question = Question.objects.create(**validated_data)
        for index, option in enumerate(options):
            AnswerOption.objects.create(question=question, order=option.get("order", index), **{
                key: value for key, value in option.items() if key not in {"id", "order"}
            })
        return question

    def update(self, instance, validated_data):
        options = validated_data.pop("options", None)
        image_base64 = validated_data.pop("image_base64", "")
        image_url = validated_data.pop("image_url", "")
        if image_base64:
            validated_data["image"] = image_from_base64(image_base64)
        elif image_url:
            validated_data["image"] = image_from_url(image_url)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if options is not None:
            instance.options.all().delete()
            for index, option in enumerate(options):
                AnswerOption.objects.create(question=instance, order=option.get("order", index), **{
                    key: value for key, value in option.items() if key not in {"id", "order"}
                })
        return instance


class QuizManageSerializer(serializers.ModelSerializer):
    questions = QuestionWriteSerializer(many=True, required=False)
    course_slug = serializers.CharField(source="lesson.section.course.slug", read_only=True)
    lesson_title_uz = serializers.CharField(source="lesson.title_uz", read_only=True)
    lesson_title_ru = serializers.CharField(source="lesson.title_ru", read_only=True)
    questions_count = serializers.IntegerField(read_only=True)
    attempts_count = serializers.SerializerMethodField()
    pass_rate = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            "id",
            "lesson",
            "course_slug",
            "lesson_title_uz",
            "lesson_title_ru",
            "title_uz",
            "title_ru",
            "description_uz",
            "description_ru",
            "passing_score",
            "total_questions",
            "randomize_questions",
            "randomize_options",
            "is_active",
            "questions_count",
            "attempts_count",
            "pass_rate",
            "questions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["questions_count", "attempts_count", "pass_rate", "created_at", "updated_at"]

    def get_attempts_count(self, obj):
        return obj.attempts.count()

    def get_pass_rate(self, obj):
        total = obj.attempts.filter(completed_at__isnull=False).count()
        if not total:
            return 0
        return round((obj.attempts.filter(passed=True).count() / total) * 100)

    def validate(self, attrs):
        request = self.context.get("request")
        lesson = attrs.get("lesson", getattr(self.instance, "lesson", None))
        if not lesson:
            raise serializers.ValidationError({"lesson": "Lesson is required."})
        course = lesson.section.course
        if request and request.user.role == "teacher" and course.teacher_id != request.user.id:
            raise serializers.ValidationError({"lesson": "You can only manage quizzes for your own courses."})
        total = attrs.get("total_questions", getattr(self.instance, "total_questions", 10))
        passing = attrs.get("passing_score", getattr(self.instance, "passing_score", 7))
        if passing > total:
            raise serializers.ValidationError({"passing_score": "Passing score cannot exceed total questions."})
        questions = attrs.get("questions")
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", False))
        if is_active:
            count = len(questions) if questions is not None else (self.instance.questions.count() if self.instance else 0)
            if count != total:
                raise serializers.ValidationError(
                    {"questions": f"An active quiz must contain exactly {total} questions (currently {count})."}
                )
        return attrs

    def create(self, validated_data):
        questions = validated_data.pop("questions", [])
        quiz = Quiz.objects.create(**validated_data)
        self._save_questions(quiz, questions)
        return quiz

    def update(self, instance, validated_data):
        questions = validated_data.pop("questions", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if questions is not None:
            instance.questions.all().delete()
            self._save_questions(instance, questions)
        return instance

    def _save_questions(self, quiz, questions):
        for index, question_data in enumerate(questions):
            options = question_data.pop("options", [])
            image_base64 = question_data.pop("image_base64", "")
            image_url = question_data.pop("image_url", "")
            if image_base64:
                question_data["image"] = image_from_base64(image_base64)
            elif image_url:
                question_data["image"] = image_from_url(image_url)
            if "order" not in question_data:
                question_data["order"] = index
            question = Question.objects.create(quiz=quiz, **question_data)
            for option_index, option in enumerate(options):
                AnswerOption.objects.create(
                    question=question,
                    order=option.get("order", option_index),
                    **{key: value for key, value in option.items() if key not in {"id", "order"}},
                )


class SubmitAnswerSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    selected_options = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    text_answer = serializers.CharField(required=False, allow_blank=True, default="")


class SubmitAttemptSerializer(serializers.Serializer):
    answers = SubmitAnswerSerializer(many=True)

    def validate_answers(self, value):
        ids = [item["question_id"] for item in value]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Each question can only be answered once.")
        return value
