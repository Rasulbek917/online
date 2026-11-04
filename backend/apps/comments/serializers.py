from rest_framework import serializers

from apps.users.serializers import UserPublicSerializer
from .models import Comment, CommentReply


class CommentReplySerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)
    is_owner = serializers.SerializerMethodField()
    can_moderate = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()

    class Meta:
        model = CommentReply
        fields = ["id", "user", "body", "is_deleted", "is_owner", "can_moderate", "created_at"]

    def _user(self):
        request = self.context.get("request")
        return request.user if request and request.user.is_authenticated else None

    def get_is_owner(self, obj):
        user = self._user()
        return bool(user and obj.user_id == user.id)

    def get_can_moderate(self, obj):
        user = self._user()
        if not user:
            return False
        return user.role in {"admin", "teacher"} or user.is_superuser or obj.user_id == user.id

    def get_body(self, obj):
        return "" if obj.is_deleted else obj.body


class CommentSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    can_moderate = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()
    lesson_title = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "course",
            "lesson",
            "lesson_title",
            "user",
            "body",
            "is_pinned",
            "is_deleted",
            "is_owner",
            "can_moderate",
            "replies_count",
            "replies",
            "created_at",
        ]
        read_only_fields = ["id", "user", "is_pinned", "is_deleted", "created_at"]

    def _user(self):
        request = self.context.get("request")
        return request.user if request and request.user.is_authenticated else None

    def get_body(self, obj):
        return "" if obj.is_deleted else obj.body

    def get_replies(self, obj):
        replies = [reply for reply in obj.replies.all() if not reply.is_deleted or (self._user() and self._user().role in {"admin", "teacher"})]
        return CommentReplySerializer(replies, many=True, context=self.context).data

    def get_replies_count(self, obj):
        return obj.replies.filter(is_deleted=False).count()

    def get_is_owner(self, obj):
        user = self._user()
        return bool(user and obj.user_id == user.id)

    def get_can_moderate(self, obj):
        user = self._user()
        if not user:
            return False
        if user.role in {"admin", "teacher"} or user.is_superuser:
            return True
        return obj.user_id == user.id

    def get_lesson_title(self, obj):
        if not obj.lesson:
            return None
        request = self.context.get("request")
        lang = request.query_params.get("lang", "uz") if request else "uz"
        return obj.lesson.title_ru if lang == "ru" else obj.lesson.title_uz


class CommentCreateSerializer(serializers.Serializer):
    course_slug = serializers.SlugField()
    lesson_id = serializers.IntegerField(required=False, allow_null=True)
    body = serializers.CharField(max_length=4000)

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError("Comment cannot be empty.")
        return value.strip()
