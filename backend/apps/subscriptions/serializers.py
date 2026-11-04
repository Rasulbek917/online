from rest_framework import serializers

from apps.courses.serializers import CourseListSerializer
from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    in_grace = serializers.BooleanField(read_only=True)
    access_until = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "course",
            "status",
            "started_at",
            "current_period_start",
            "current_period_end",
            "grace_until",
            "access_until",
            "days_remaining",
            "in_grace",
            "canceled_at",
            "created_at",
        ]
