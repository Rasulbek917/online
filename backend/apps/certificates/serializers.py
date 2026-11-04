from rest_framework import serializers

from apps.courses.serializers import CourseListSerializer
from .models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    student_name = serializers.CharField(source="user.full_name", read_only=True)
    teacher_name = serializers.CharField(source="course.teacher.full_name", read_only=True)
    verify_url = serializers.CharField(read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "id",
            "certificate_id",
            "course",
            "student_name",
            "teacher_name",
            "issued_at",
            "revoked",
            "revoked_reason",
            "pdf_file",
            "verify_url",
            "download_url",
        ]

    def get_download_url(self, obj):
        request = self.context.get("request")
        path = f"/api/certificates/{obj.certificate_id}/download/"
        return request.build_absolute_uri(path) if request else path


class CertificateVerifySerializer(serializers.ModelSerializer):
    valid = serializers.BooleanField(source="is_valid", read_only=True)
    student_name = serializers.CharField(source="user.full_name", read_only=True)
    course_title_uz = serializers.CharField(source="course.title_uz", read_only=True)
    course_title_ru = serializers.CharField(source="course.title_ru", read_only=True)
    teacher_name = serializers.CharField(source="course.teacher.full_name", read_only=True)
    verify_url = serializers.CharField(read_only=True)
    verifications_count = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "certificate_id",
            "valid",
            "student_name",
            "course_title_uz",
            "course_title_ru",
            "teacher_name",
            "issued_at",
            "revoked",
            "revoked_reason",
            "verify_url",
            "verifications_count",
        ]

    def get_verifications_count(self, obj):
        return obj.verifications.count()
