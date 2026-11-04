import io
import logging
from pathlib import Path

import qrcode
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from apps.analytics.services import award_points
from apps.courses.services import course_progress
from .models import Certificate

logger = logging.getLogger("apps.certificates")

GOLD = HexColor("#C8A24A")
DARK = HexColor("#0B1020")
NAVY = HexColor("#111B3A")
MUTED = HexColor("#5B6478")

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_SERIF = "Times-Roman"
FONT_SERIF_BOLD = "Times-Bold"

for candidate in [
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
]:
    if candidate.exists():
        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans", str(candidate)))
            bold = candidate.with_name("DejaVuSans-Bold.ttf")
            if bold.exists():
                pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", str(bold)))
                FONT_REGULAR = "DejaVuSans"
                FONT_BOLD = "DejaVuSans-Bold"
            serif = candidate.with_name("DejaVuSerif.ttf")
            serif_bold = candidate.with_name("DejaVuSerif-Bold.ttf")
            if serif.exists() and serif_bold.exists():
                pdfmetrics.registerFont(TTFont("DejaVuSerif", str(serif)))
                pdfmetrics.registerFont(TTFont("DejaVuSerif-Bold", str(serif_bold)))
                FONT_SERIF = "DejaVuSerif"
                FONT_SERIF_BOLD = "DejaVuSerif-Bold"
        except Exception:
            logger.warning("Could not register DejaVu fonts for certificate PDF")
        break


@transaction.atomic
def issue_certificate_if_eligible(user, course):
    if not user or not user.is_authenticated or user.role != "student":
        return None
    existing = Certificate.objects.select_for_update().filter(user=user, course=course).first()
    if existing:
        return existing
    progress = course_progress(user, course, update_cache=False, auto_issue=False)
    if not progress["is_complete"]:
        return None
    certificate = Certificate.objects.create(
        user=user,
        course=course,
        metadata={
            "completed_lessons": progress["completed_lessons"],
            "total_lessons": progress["total_lessons"],
            "quizzes_passed": progress["completed_quizzes"],
            "issued_by": "system",
        },
    )
    try:
        pdf_bytes = render_certificate_pdf(certificate)
        certificate.pdf_file.save(
            f"{certificate.certificate_id}.pdf", ContentFile(pdf_bytes), save=True
        )
    except Exception:
        logger.exception("Certificate PDF generation failed for %s", certificate.certificate_id)
    _notify(certificate)
    try:
        award_points(user, 50, "certificate_issued", reference=f"certificate:{certificate.id}")
    except Exception:
        logger.exception("Points award failed for certificate %s", certificate.id)
    return certificate


def _notify(certificate):
    try:
        from apps.notifications.services import notify_user

        notify_user(
            certificate.user,
            "certificate_ready",
            title_uz="Sertifikatingiz tayyor",
            title_ru="Ваш сертификат готов",
            message_uz=f"{certificate.course.title_uz} kursi bo'yicha sertifikat yaratildi. Uni yuklab oling.",
            message_ru=f"Сертификат по курсу «{certificate.course.title_ru}» готов к скачиванию.",
            data={
                "certificate_id": certificate.certificate_id,
                "course_slug": certificate.course.slug,
            },
            telegram=True,
            push=True,
        )
    except Exception:
        logger.exception("Certificate notification failed for %s", certificate.id)


def render_certificate_pdf(certificate):
    course = certificate.course
    user = certificate.user
    teacher = course.teacher
    buffer = io.BytesIO()
    page = landscape(A4)
    pdf = canvas.Canvas(buffer, pagesize=page)
    width, height = page

    pdf.setFillColor(white)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(2.2)
    pdf.rect(12 * mm, 12 * mm, width - 24 * mm, height - 24 * mm)
    pdf.setLineWidth(0.6)
    pdf.rect(16 * mm, 16 * mm, width - 32 * mm, height - 32 * mm)

    # Decorative corner accents
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(1.4)
    for x, y, dx, dy in [
        (22 * mm, 22 * mm, 1, 1),
        (width - 22 * mm, 22 * mm, -1, 1),
        (22 * mm, height - 22 * mm, 1, -1),
        (width - 22 * mm, height - 22 * mm, -1, -1),
    ]:
        pdf.line(x, y, x + dx * 12 * mm, y)
        pdf.line(x, y, x, y + dy * 12 * mm)

    pdf.setFillColor(NAVY)
    pdf.setFont(FONT_BOLD, 13)
    pdf.drawCentredString(width / 2, height - 34 * mm, "IT PARK ACADEMY")
    pdf.setFillColor(GOLD)
    pdf.setFont(FONT_REGULAR, 8)
    pdf.drawCentredString(width / 2, height - 40 * mm, "P R O F E S S I O N A L   I T   E D U C A T I O N")

    pdf.setFillColor(DARK)
    pdf.setFont(FONT_SERIF_BOLD, 34)
    pdf.drawCentredString(width / 2, height - 66 * mm, "CERTIFICATE")
    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 10)
    pdf.drawCentredString(width / 2, height - 75 * mm, "OF COMPLETION")

    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 10)
    pdf.drawCentredString(width / 2, height - 94 * mm, "This certificate is proudly presented to")

    pdf.setFillColor(NAVY)
    name = user.full_name
    pdf.setFont(FONT_SERIF_BOLD, 30 if len(name) < 30 else 24)
    pdf.drawCentredString(width / 2, height - 112 * mm, name)

    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(0.8)
    pdf.line(width / 2 - 70 * mm, height - 119 * mm, width / 2 + 70 * mm, height - 119 * mm)

    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 10)
    pdf.drawCentredString(width / 2, height - 130 * mm, "for successfully completing the professional course")
    pdf.setFillColor(DARK)
    course_name = course.title_uz
    pdf.setFont(FONT_BOLD, 18 if len(course_name) < 55 else 14)
    pdf.drawCentredString(width / 2, height - 142 * mm, course_name)

    level = course.get_level_display()
    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 9)
    pdf.drawCentredString(
        width / 2,
        height - 150 * mm,
        f"{level} · {course.lessons_count} lessons · {course.duration_minutes} minutes",
    )

    # Footer metadata
    left = 34 * mm
    bottom = 34 * mm
    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 8)
    pdf.drawString(left, bottom + 18 * mm, "CERTIFICATE ID")
    pdf.setFillColor(DARK)
    pdf.setFont(FONT_BOLD, 10)
    pdf.drawString(left, bottom + 12 * mm, certificate.certificate_id)

    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 8)
    pdf.drawString(left, bottom + 5 * mm, "ISSUED ON")
    pdf.setFillColor(DARK)
    pdf.setFont(FONT_BOLD, 10)
    pdf.drawString(left, bottom - 1 * mm, certificate.issued_at.strftime("%d.%m.%Y"))

    # Signature
    signer = teacher.full_name
    pdf.setStrokeColor(DARK)
    pdf.setLineWidth(0.6)
    pdf.line(width - 104 * mm, bottom + 8 * mm, width - 34 * mm, bottom + 8 * mm)
    pdf.setFillColor(DARK)
    pdf.setFont(FONT_BOLD, 10)
    pdf.drawCentredString(width - 69 * mm, bottom + 2 * mm, signer)
    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 8)
    pdf.drawCentredString(width - 69 * mm, bottom - 4 * mm, "Course Instructor · IT PARK ACADEMY")

    # QR
    qr = qrcode.QRCode(version=1, box_size=8, border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(certificate.verify_url)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="#0B1020", back_color="white")
    qr_buffer = io.BytesIO()
    qr_image.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    qr_size = 28 * mm
    pdf.drawImage(
        ImageReader(qr_buffer),
        width - 50 * mm,
        height - 60 * mm,
        width=qr_size,
        height=qr_size,
        mask="auto",
    )
    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 6)
    pdf.drawCentredString(width - 36 * mm, height - 64 * mm, "Scan to verify")

    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 7)
    pdf.drawCentredString(
        width / 2,
        20 * mm,
        f"Verify authenticity at {settings.FRONTEND_URL}/verify/certificate/{certificate.certificate_id}",
    )
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
