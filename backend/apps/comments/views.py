from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.courses.models import Course, Lesson
from apps.courses.services import has_course_access
from apps.notifications.services import notify_user
from .models import Comment, CommentReply
from .serializers import CommentCreateSerializer, CommentReplySerializer, CommentSerializer


class CommentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["lesson", "course"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Comment.objects.select_related("user", "lesson", "course").prefetch_related(
            "replies__user"
        )
        qs = qs.filter(is_deleted=False) if self.request.query_params.get("include_deleted") != "1" else qs
        if self.request.query_params.get("scope") == "teacher":
            user = self.request.user
            if not user.is_authenticated:
                return qs.none()
            if user.role == "teacher":
                qs = qs.filter(course__teacher=user)
            elif user.role != "admin" and not user.is_superuser:
                return qs.none()
        course_slug = self.request.query_params.get("course_slug")
        if course_slug:
            qs = qs.filter(course__slug=course_slug)
        lesson_id = self.request.query_params.get("lesson_id")
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        if self.action == "list" and self.request.query_params.get("mine") in {"1", "true"}:
            qs = qs.filter(user=self.request.user)
        return qs

    def _can_moderate(self, comment):
        user = self.request.user
        if user.role == "admin" or user.is_superuser:
            return True
        if user.role == "teacher":
            return comment.course.teacher_id == user.id
        return comment.user_id == user.id

    def create(self, request):
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = get_object_or_404(
            Course, slug=serializer.validated_data["course_slug"], status=Course.Status.PUBLISHED
        )
        lesson = None
        lesson_id = serializer.validated_data.get("lesson_id")
        if lesson_id:
            lesson = get_object_or_404(Lesson, pk=lesson_id, section__course=course)
            if not (lesson.is_free_preview or has_course_access(request.user, course)):
                raise PermissionDenied("You need course access to comment on this lesson.")
        comment = Comment.objects.create(
            course=course,
            lesson=lesson,
            user=request.user,
            body=serializer.validated_data["body"],
        )
        if request.user.id != course.teacher_id:
            notify_user(
                course.teacher,
                "comment",
                title_uz="Yangi savol",
                title_ru="Новый вопрос",
                message_uz=f"{request.user.full_name} — {course.title_uz}: {comment.body[:120]}",
                message_ru=f"{request.user.full_name} — {course.title_ru}: {comment.body[:120]}",
                data={"course_slug": course.slug, "comment_id": comment.id, "lesson_id": lesson_id or 0},
                push=True,
            )
        return Response(
            CommentSerializer(comment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if not self._can_moderate(comment):
            raise PermissionDenied("You cannot delete this comment.")
        comment.is_deleted = True
        comment.body = ""
        comment.moderated_by = request.user
        comment.save(update_fields=["is_deleted", "body", "moderated_by", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        comment = self.get_object()
        body = (request.data.get("body") or "").strip()
        if not body:
            raise ValidationError({"body": "Reply cannot be empty."})
        if comment.is_deleted:
            raise ValidationError({"detail": "Cannot reply to a deleted comment."})
        if request.user.role == "student" and not has_course_access(request.user, comment.course):
            raise PermissionDenied("You need course access to reply.")
        reply = CommentReply.objects.create(comment=comment, user=request.user, body=body)
        recipient = comment.user
        if reply.user_id == recipient.id and request.user.role != "teacher":
            recipient = comment.course.teacher
        if recipient.id != reply.user_id:
            notify_user(
                recipient,
                "comment",
                title_uz="Yangi javob",
                title_ru="Новый ответ",
                message_uz=f"{request.user.full_name}: {body[:120]}",
                message_ru=f"{request.user.full_name}: {body[:120]}",
                data={"course_slug": comment.course.slug, "comment_id": comment.id, "reply_id": reply.id},
                telegram=True,
            )
        return Response(
            CommentReplySerializer(reply, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def pin(self, request, pk=None):
        comment = self.get_object()
        if request.user.role not in {"teacher", "admin"} and not request.user.is_superuser:
            raise PermissionDenied("Only teachers can pin comments.")
        comment.is_pinned = not comment.is_pinned
        comment.save(update_fields=["is_pinned", "updated_at"])
        return Response(CommentSerializer(comment, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reply_as_teacher(self, request, pk=None):
        return self.reply(request, pk=pk)
