from rest_framework import serializers

from .models import Broadcast, Notification, PushDevice, TelegramAccount


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "title_uz", "title_ru", "message_uz", "message_ru", "data", "is_read", "read_at", "created_at"]
        read_only_fields = ["type", "title_uz", "title_ru", "message_uz", "message_ru", "data", "created_at"]


class TelegramAccountSerializer(serializers.ModelSerializer):
    is_linked = serializers.BooleanField(read_only=True)
    bot_username = serializers.SerializerMethodField()

    class Meta:
        model = TelegramAccount
        fields = ["username", "linked_at", "notifications_enabled", "is_linked", "bot_username"]

    def get_bot_username(self, obj):
        from django.conf import settings

        return settings.TELEGRAM_BOT_USERNAME


class PushDeviceSerializer(serializers.ModelSerializer):
    token = serializers.CharField(max_length=512, validators=[])

    class Meta:
        model = PushDevice
        fields = ["id", "token", "platform", "device_name", "is_active", "last_seen_at"]
        read_only_fields = ["is_active", "last_seen_at"]

    def create(self, validated_data):
        request = self.context["request"]
        device, _ = PushDevice.objects.update_or_create(
            token=validated_data["token"],
            defaults={
                "user": request.user,
                "platform": validated_data.get("platform", "android"),
                "device_name": validated_data.get("device_name", ""),
                "is_active": True,
            },
        )
        return device


class BroadcastHistorySerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True, allow_null=True)

    class Meta:
        model = Broadcast
        fields = [
            "id",
            "created_by_email",
            "type",
            "audience",
            "course_slug",
            "title_uz",
            "title_ru",
            "message_uz",
            "message_ru",
            "recipients_count",
            "telegram",
            "push",
            "created_at",
        ]


class BroadcastSerializer(serializers.Serializer):
    title_uz = serializers.CharField(max_length=180)
    title_ru = serializers.CharField(max_length=180)
    message_uz = serializers.CharField()
    message_ru = serializers.CharField()
    type = serializers.ChoiceField(choices=Notification.Type.choices, default=Notification.Type.SYSTEM)
    audience = serializers.ChoiceField(choices=["all", "students", "course"], default="students")
    course_slug = serializers.SlugField(required=False, allow_blank=True)
    telegram = serializers.BooleanField(default=False)
    push = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs["audience"] == "course" and not attrs.get("course_slug"):
            raise serializers.ValidationError({"course_slug": "Course is required for course audience."})
        return attrs
