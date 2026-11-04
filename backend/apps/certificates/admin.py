from django.contrib import admin

from .models import Certificate, CertificateVerification


class VerificationInline(admin.TabularInline):
    model = CertificateVerification
    extra = 0
    readonly_fields = ("ip_address", "user_agent", "verified_at")


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ("certificate_id", "user", "course", "issued_at", "revoked")
    list_filter = ("revoked", "issued_at")
    search_fields = ("certificate_id", "user__email", "course__title_uz")
    autocomplete_fields = ("user", "course")
    readonly_fields = ("certificate_id", "issued_at", "metadata", "verifications_count")
    inlines = [VerificationInline]

    @admin.display(description="Verification scans")
    def verifications_count(self, obj):
        return obj.verifications.count()
