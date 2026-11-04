import logging

from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from common.permissions import IsAdminRole
from common.utils import get_client_ip
from .models import Certificate, CertificateVerification
from .serializers import CertificateSerializer, CertificateVerifySerializer
from .services import render_certificate_pdf
from django.core.files.base import ContentFile

logger = logging.getLogger("apps.certificates")


class CertificateViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = CertificateSerializer
    lookup_field = "certificate_id"

    def get_queryset(self):
        user = self.request.user
        qs = Certificate.objects.select_related(
            "user", "course", "course__teacher", "course__category"
        )
        if user.role == "admin" or user.is_superuser:
            return qs
        if user.role == "teacher":
            return qs.filter(course__teacher=user)
        return qs.filter(user=user)

    @action(detail=True, methods=["get"])
    def download(self, request, certificate_id=None):
        certificate = self.get_object()
        if not certificate.pdf_file:
            try:
                pdf = render_certificate_pdf(certificate)
                certificate.pdf_file.save(
                    f"{certificate.certificate_id}.pdf", ContentFile(pdf), save=True
                )
            except Exception:
                logger.exception("Could not generate certificate PDF")
                return Response(
                    {"error": {"code": "pdf_error", "message": "Certificate PDF is unavailable."}},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        return FileResponse(
            certificate.pdf_file.open("rb"),
            as_attachment=True,
            filename=f"{certificate.certificate_id}.pdf",
            content_type="application/pdf",
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAdminRole])
    def revoke(self, request, certificate_id=None):
        certificate = self.get_object()
        reason = request.data.get("reason", "Revoked by administrator")
        certificate.revoked = True
        certificate.revoked_reason = reason
        certificate.revoked_at = timezone.now()
        certificate.save(update_fields=["revoked", "revoked_reason", "revoked_at", "updated_at"])
        return Response(CertificateSerializer(certificate, context={"request": request}).data)


class CertificateVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "anon"

    def get(self, request, certificate_id):
        certificate = Certificate.objects.select_related(
            "user", "course", "course__teacher"
        ).filter(certificate_id=certificate_id).first()
        if not certificate:
            return Response(
                {
                    "error": {
                        "code": "certificate_not_found",
                        "message": "No certificate exists with this identifier.",
                    }
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        CertificateVerification.objects.create(
            certificate=certificate,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("User-Agent", "")[:500],
            verified_at=timezone.now(),
        )
        return Response(CertificateVerifySerializer(certificate, context={"request": request}).data)
