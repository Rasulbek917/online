"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, BadgeCheck, BookOpen, Download, ExternalLink, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { apiDownload } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useCertificates } from "@/lib/queries";
import { formatDate, getErrorMessage } from "@/lib/utils";
import type { Certificate } from "@/lib/types";
import { PageHeading } from "./shared";

export function CertificatesPage() {
  const { t, lang } = useI18n();
  const certificates = useCertificates();
  const [downloading, setDownloading] = useState<number | null>(null);

  const download = async (certificate: Certificate) => {
    setDownloading(certificate.id);
    try {
      await apiDownload(`/api/certificates/${certificate.certificate_id}/download/`, `${certificate.certificate_id}.pdf`);
    } catch (error) {
      toast.error(getErrorMessage(error, t("toast.error")));
    } finally {
      setDownloading(null);
    }
  };

  if (certificates.isError) {
    return <ErrorState onRetry={() => certificates.refetch()} />;
  }

  const items = certificates.data?.results ?? [];

  return (
    <div>
      <PageHeading
        eyebrow={t("dashboard.account")}
        title={t("certificates.title")}
        subtitle={t("certificates.subtitle")}
        actions={
          <Button asChild variant="outline">
            <Link href="/verify/certificate">
              <ShieldCheck className="h-4 w-4" />
              {t("certificates.verifyTitle")}
            </Link>
          </Button>
        }
      />

      {certificates.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Award}
          title={t("certificates.myEmpty")}
          description={t("certificates.myEmptyHint")}
          actionLabel={t("dashboard.browseCourses")}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {items.map((certificate) => (
            <article
              key={certificate.id}
              className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/12 via-card to-primary/10 p-5 shadow-lg shadow-gold/5"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/15 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/20 text-gold">
                    <Award className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
                      {t("certificates.issuedBy")}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("certificates.verifiedBadge")}</p>
                  </div>
                </div>
                {certificate.revoked ? (
                  <Badge variant="destructive">{t("certificates.revoked")}</Badge>
                ) : (
                  <Badge variant="gold" className="gap-1">
                    <BadgeCheck className="h-3 w-3" />
                    {t("certificates.valid")}
                  </Badge>
                )}
              </div>

              <h2 className="relative mt-4 line-clamp-2 text-lg font-bold leading-snug">
                {certificate.course.title}
              </h2>

              <dl className="relative mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">{t("certificates.student")}</dt>
                  <dd className="mt-0.5 truncate font-semibold">{certificate.student_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("certificates.teacher")}</dt>
                  <dd className="mt-0.5 truncate font-semibold">{certificate.teacher_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("certificates.issuedOn")}</dt>
                  <dd className="mt-0.5 font-medium">{formatDate(certificate.issued_at, lang)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("certificates.certificateId")}</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-mono text-[11px] font-semibold text-gold">
                    <QrCode className="h-3 w-3" />
                    {certificate.certificate_id}
                  </dd>
                </div>
              </dl>

              {certificate.revoked && certificate.revoked_reason ? (
                <p className="relative mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                  {t("certificates.revokedReason")}: {certificate.revoked_reason}
                </p>
              ) : null}

              <div className="relative mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="gold"
                  disabled={downloading === certificate.id || !certificate.pdf_file}
                  onClick={() => download(certificate)}
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloading === certificate.id ? t("common.loading") : t("certificates.download")}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/verify/certificate/${certificate.certificate_id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("certificates.verify")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/courses/${certificate.course.slug}`}>
                    <BookOpen className="h-3.5 w-3.5" />
                    {t("common.viewCourse")}
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
