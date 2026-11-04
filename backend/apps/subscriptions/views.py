from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Subscription
from .serializers import SubscriptionSerializer


class SubscriptionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        return Subscription.objects.filter(user=self.request.user).select_related(
            "course", "course__category", "course__teacher"
        )

    @action(detail=False, methods=["get"])
    def active(self, request):
        queryset = self.get_queryset().filter(status__in=["active", "grace"])
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        subscription = self.get_object()
        from django.utils import timezone

        subscription.canceled_at = timezone.now()
        subscription.save(update_fields=["canceled_at", "updated_at"])
        return Response(
            {
                "detail": "Subscription canceled. Access remains active until the paid period ends.",
                "subscription": self.get_serializer(subscription).data,
            }
        )
