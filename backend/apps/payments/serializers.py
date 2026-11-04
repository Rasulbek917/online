from rest_framework import serializers

from apps.courses.serializers import CourseListSerializer
from .models import Payment, PaymentAuditLog


class PaymentSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    provider_label = serializers.CharField(source="get_provider_display", read_only=True)
    billing_period_label = serializers.CharField(source="get_billing_period_display", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "course",
            "provider",
            "provider_label",
            "billing_period",
            "billing_period_label",
            "amount",
            "currency",
            "status",
            "checkout_url",
            "failure_reason",
            "paid_at",
            "created_at",
        ]


class PaymentAdminSerializer(PaymentSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    provider_transaction_id = serializers.CharField(read_only=True)

    class Meta(PaymentSerializer.Meta):
        fields = PaymentSerializer.Meta.fields + [
            "user_email",
            "user_name",
            "provider_transaction_id",
        ]


class CheckoutSerializer(serializers.Serializer):
    course_slug = serializers.SlugField()
    provider = serializers.ChoiceField(choices=Payment.Provider.choices)
    billing_period = serializers.ChoiceField(
        choices=Payment.BillingPeriod.choices, default=Payment.BillingPeriod.MONTHLY
    )


class PaymentAuditSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True, allow_null=True)

    class Meta:
        model = PaymentAuditLog
        fields = ["id", "action", "actor_email", "metadata", "created_at"]
