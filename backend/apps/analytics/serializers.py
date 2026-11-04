from rest_framework import serializers

from apps.users.serializers import UserPublicSerializer
from .models import AuditLog, DailyAnalytics, Leaderboard, SystemSettings, Testimonial


class TestimonialSerializer(serializers.ModelSerializer):
    quote = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Testimonial
        fields = ["id", "name", "role", "quote", "rating", "avatar", "order"]

    def _lang(self):
        request = self.context.get("request")
        return request.query_params.get("lang", "uz") if request else "uz"

    def get_quote(self, obj):
        return obj.quote_ru if self._lang() == "ru" else obj.quote_uz

    def get_role(self, obj):
        return obj.role_ru if self._lang() == "ru" else obj.role_uz

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url


class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    user = UserPublicSerializer()
    points = serializers.IntegerField()
    completed_courses = serializers.IntegerField()
    quiz_accuracy = serializers.FloatField()
    score = serializers.FloatField()
    is_me = serializers.BooleanField(default=False)


class PublicSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = [
            "site_name",
            "support_email",
            "support_phone",
            "telegram_url",
            "instagram_url",
            "youtube_url",
            "default_language",
            "grace_period_days",
            "quiz_passing_score",
            "announcement",
            "maintenance_mode",
        ]


class AdminSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class DailyAnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyAnalytics
        fields = "__all__"


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True, allow_null=True)

    class Meta:
        model = AuditLog
        fields = ["id", "user_email", "action", "model_name", "object_id", "ip_address", "metadata", "created_at"]
