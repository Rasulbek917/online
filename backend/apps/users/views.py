from django.db.models import Count, Q
from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from common.permissions import IsAdminRole, IsTeacherOrAdmin
from .models import User
from .serializers import UserAdminSerializer, UserPublicSerializer


class UserViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = User.objects.select_related("profile").annotate(
        courses_count=Count("taught_courses", distinct=True),
        enrollments_count=Count("enrollments", distinct=True),
    )
    serializer_class = UserAdminSerializer
    permission_classes = [IsAdminRole]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["email", "first_name", "last_name", "phone"]
    ordering_fields = ["created_at", "email", "last_login"]
    filterset_fields = ["role", "is_active", "is_email_verified"]

    @action(detail=False, methods=["get"], permission_classes=[IsTeacherOrAdmin])
    def students(self, request):
        queryset = self.get_queryset().filter(role=User.Role.STUDENT)
        if request.user.role == "teacher":
            queryset = queryset.filter(
                Q(enrollments__course__teacher=request.user)
                | Q(video_progress__lesson__section__course__teacher=request.user)
            ).distinct()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminRole])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response({"detail": "You cannot disable your own account."}, status=400)
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        return Response(self.get_serializer(user).data)

    def perform_update(self, serializer):
        validated = serializer.validated_data
        if serializer.instance_id == self.request.user.id:
            if "role" in validated and validated["role"] != serializer.instance.role:
                raise ValidationError({"role": "You cannot change your own role."})
            if validated.get("is_active") is False:
                raise ValidationError({"is_active": "You cannot deactivate your own account."})
        serializer.save()


class PublicUserViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserPublicSerializer
    permission_classes = []
