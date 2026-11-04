from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import TimeStampedModel
from common.utils import generate_certificate_id


class Certificate(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="certificates"
    )
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="certificates")
    certificate_id = models.CharField(max_length=32, unique=True, db_index=True, default=generate_certificate_id)
    issued_at = models.DateTimeField(default=timezone.now, db_index=True)
    pdf_file = models.FileField(upload_to="certificates/%Y/%m/", blank=True, null=True)
    revoked = models.BooleanField(default=False, db_index=True)
    revoked_reason = models.CharField(max_length=255, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-issued_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="unique_certificate_per_user_course")
        ]
        indexes = [models.Index(fields=["certificate_id", "revoked"])]

    def __str__(self):
        return f"{self.certificate_id} - {self.user.full_name}"

    @property
    def is_valid(self):
        return not self.revoked

    @property
    def verify_url(self):
        return f"{settings.FRONTEND_URL}/verify/certificate/{self.certificate_id}"


class CertificateVerification(TimeStampedModel):
    certificate = models.ForeignKey(
        Certificate, on_delete=models.CASCADE, related_name="verifications"
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    verified_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-verified_at"]
