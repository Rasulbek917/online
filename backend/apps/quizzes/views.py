from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.courses.models import Course
from apps.courses.services import course_progress
from common.permissions import IsTeacherOrAdmin
from .models import Quiz, QuizAttempt
from .serializers import (
    AttemptQuestionSerializer,
    QuizAttemptDetailSerializer,
    QuizAttemptSerializer,
    QuizManageSerializer,
    QuizStudentSerializer,
    SubmitAttemptSerializer,
)
from .services import attempt_questions, can_take_quiz, start_attempt, submit_attempt


class QuizViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filterset_fields = ["lesson", "is_active"]

    def get_queryset(self):
        user = self.request.user
        qs = Quiz.objects.select_related(
            "lesson", "lesson__section", "lesson__section__course"
        ).prefetch_related("questions__options")
        if user.role in {"teacher", "admin"} or user.is_superuser:
            if user.role == "teacher":
                return qs.filter(lesson__section__course__teacher=user)
            return qs
        return qs.filter(is_active=True, lesson__section__course__status=Course.Status.PUBLISHED)

    def get_serializer_class(self):
        user = self.request.user
        if user.role in {"teacher", "admin"} or user.is_superuser:
            return QuizManageSerializer
        return QuizStudentSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsTeacherOrAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == "teacher" and instance.lesson.section.course.teacher_id != user.id:
            raise PermissionDenied("You can only delete quizzes from your own courses.")
        instance.delete()

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        quiz = self.get_object()
        attempt, created = start_attempt(request.user, quiz)
        context = {"request": request}
        questions = attempt_questions(attempt)
        return Response(
            {
                "attempt": QuizAttemptSerializer(attempt, context=context).data,
                "quiz": QuizStudentSerializer(quiz, context=context).data,
                "questions": [
                    AttemptQuestionSerializer((question, options), context=context).data
                    for question, options in questions
                ],
                "resumed": not created,
                "answers_required": quiz.total_questions,
                "passing_score": quiz.passing_score,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def attempts(self, request, pk=None):
        quiz = self.get_object()
        qs = QuizAttempt.objects.filter(quiz=quiz).select_related("user", "quiz", "quiz__lesson", "quiz__lesson__section__course")
        if request.user.role not in {"teacher", "admin"} and not request.user.is_superuser:
            qs = qs.filter(user=request.user)
        page = self.paginate_queryset(qs)
        serializer = QuizAttemptSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)


class QuizAttemptViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = QuizAttemptSerializer
    filterset_fields = ["quiz", "passed", "quiz__lesson"]
    ordering_fields = ["created_at", "correct_count"]

    def get_queryset(self):
        user = self.request.user
        qs = QuizAttempt.objects.select_related(
            "user", "quiz", "quiz__lesson", "quiz__lesson__section", "quiz__lesson__section__course"
        )
        if user.role in {"teacher", "admin"} or user.is_superuser:
            if user.role == "teacher":
                return qs.filter(quiz__lesson__section__course__teacher=user)
            return qs
        return qs.filter(user=user)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return QuizAttemptDetailSerializer
        return QuizAttemptSerializer

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        attempt = self.get_object()
        if attempt.user_id != request.user.id:
            raise PermissionDenied("Only the student who started this attempt can submit it.")
        serializer = SubmitAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attempt = submit_attempt(attempt, serializer.validated_data["answers"])
        course = attempt.quiz.lesson.section.course
        progress = course_progress(request.user, course)
        data = QuizAttemptDetailSerializer(attempt, context={"request": request}).data
        data["progress"] = {
            "percent": progress["percent"],
            "is_complete": progress["is_complete"],
            "next_lesson_id": progress["next_lesson"].id if progress["next_lesson"] else None,
        }
        return Response(data)

    @action(detail=True, methods=["get"])
    def questions(self, request, pk=None):
        attempt = self.get_object()
        if attempt.user_id != request.user.id and request.user.role not in {"teacher", "admin"}:
            raise PermissionDenied("Not your attempt.")
        if attempt.completed_at:
            return Response({"detail": "Attempt already completed."}, status=400)
        questions = attempt_questions(attempt)
        serializer = AttemptQuestionSerializer(
            [item for item in questions], many=True, context={"request": request}
        )
        return Response({"questions": serializer.data, "attempt": QuizAttemptSerializer(attempt, context={"request": request}).data})
