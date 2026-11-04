import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.analytics.models import PointsTransaction
from apps.certificates.models import Certificate, CertificateVerification
from apps.certificates.services import issue_certificate_if_eligible
from apps.notifications.models import Notification
from apps.subscriptions.models import activate_subscription
from common.testing import (
    complete_lesson,
    create_category,
    create_course,
    create_lesson,
    create_quiz,
    create_section,
    create_user,
    force_login,
)

MEDIA_ROOT = tempfile.mkdtemp(prefix="ipa-cert-tests-")


@override_settings(MEDIA_ROOT=MEDIA_ROOT, PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CertificateFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.teacher = create_user("teacher@cert.uz", role="teacher")
        self.student = create_user("student@cert.uz", first_name="Ali", last_name="Valiyev")
        self.other = create_user("other@cert.uz", first_name="Other", last_name="Student")
        self.admin = create_user("admin@cert.uz", role="admin")
        self.category = create_category()
        self.course = create_course(self.teacher, self.category, slug="cert-course", title="Cert Course")
        self.section = create_section(self.course)
        self.lessons = [create_lesson(self.course, section=self.section, order=i) for i in range(2)]
        for lesson in self.lessons:
            create_quiz(lesson)
        activate_subscription(self.student, self.course)

    def finish_course(self):
        for lesson in self.lessons:
            complete_lesson(self.student, lesson)

    def test_certificate_is_not_issued_before_completion(self):
        certificate = issue_certificate_if_eligible(self.student, self.course)
        self.assertIsNone(certificate)
        self.assertEqual(Certificate.objects.count(), 0)

    def test_completion_issues_certificate_with_pdf_points_and_notification(self):
        self.finish_course()
        certificate = issue_certificate_if_eligible(self.student, self.course)
        self.assertIsNotNone(certificate)
        self.assertFalse(certificate.revoked)
        self.assertTrue(certificate.certificate_id.startswith("IPA-"))
        self.assertTrue(certificate.pdf_file.name.endswith(".pdf"))
        self.assertGreater(certificate.pdf_file.size, 1000)
        self.assertTrue(
            PointsTransaction.objects.filter(
                user=self.student, reason="certificate_issued", reference=f"certificate:{certificate.id}"
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.student, type=Notification.Type.CERTIFICATE_READY
            ).exists()
        )

    def test_certificate_issuance_is_idempotent(self):
        self.finish_course()
        first = issue_certificate_if_eligible(self.student, self.course)
        second = issue_certificate_if_eligible(self.student, self.course)
        self.assertEqual(first.id, second.id)
        self.assertEqual(Certificate.objects.count(), 1)

    def test_teacher_or_admin_never_receives_certificate(self):
        for lesson in self.lessons:
            complete_lesson(self.teacher, lesson)
        self.assertIsNone(issue_certificate_if_eligible(self.teacher, self.course))

    def test_public_verification_records_audit_entry(self):
        self.finish_course()
        certificate = issue_certificate_if_eligible(self.student, self.course)
        response = self.client.get(f"/api/certificates/verify/{certificate.certificate_id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["certificate_id"], certificate.certificate_id)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["student_name"], "Ali Valiyev")
        self.assertEqual(CertificateVerification.objects.filter(certificate=certificate).count(), 1)

        second = self.client.get(f"/api/certificates/verify/{certificate.certificate_id}/")
        self.assertEqual(second.data["verifications_count"], 2)

    def test_verification_of_unknown_certificate_returns_404(self):
        response = self.client.get("/api/certificates/verify/IPA-0000-NOPE/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_certificate_list_is_scoped_to_owner(self):
        self.finish_course()
        certificate = issue_certificate_if_eligible(self.student, self.course)
        force_login(self.client, self.student)
        response = self.client.get("/api/certificates/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["certificate_id"], certificate.certificate_id)

        force_login(self.client, self.other)
        response = self.client.get("/api/certificates/")
        self.assertEqual(response.data["count"], 0)
        detail = self.client.get(f"/api/certificates/{certificate.certificate_id}/")
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_can_download_pdf(self):
        self.finish_course()
        certificate = issue_certificate_if_eligible(self.student, self.course)
        force_login(self.client, self.student)
        response = self.client.get(f"/api/certificates/{certificate.certificate_id}/download/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        body = b"".join(response.streaming_content)
        self.assertTrue(body.startswith(b"%PDF"))

    def test_only_admin_can_revoke_and_revocation_invalidates_verification(self):
        self.finish_course()
        certificate = issue_certificate_if_eligible(self.student, self.course)
        force_login(self.client, self.student)
        forbidden = self.client.post(f"/api/certificates/{certificate.certificate_id}/revoke/", {}, format="json")
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        force_login(self.client, self.admin)
        response = self.client.post(
            f"/api/certificates/{certificate.certificate_id}/revoke/",
            {"reason": "Fraud detected"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        certificate.refresh_from_db()
        self.assertTrue(certificate.revoked)
        self.assertEqual(certificate.revoked_reason, "Fraud detected")

        verify = self.client.get(f"/api/certificates/verify/{certificate.certificate_id}/")
        self.assertEqual(verify.status_code, status.HTTP_200_OK)
        self.assertFalse(verify.data["valid"])
        self.assertTrue(verify.data["revoked"])

    def test_pdf_is_regenerated_when_file_is_missing(self):
        self.finish_course()
        certificate = issue_certificate_if_eligible(self.student, self.course)
        certificate.pdf_file.delete(save=True)
        certificate.refresh_from_db()
        self.assertFalse(certificate.pdf_file)
        force_login(self.client, self.student)
        response = self.client.get(f"/api/certificates/{certificate.certificate_id}/download/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        certificate.refresh_from_db()
        self.assertTrue(certificate.pdf_file)
