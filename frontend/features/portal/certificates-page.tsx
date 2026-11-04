"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, Download, ExternalLink, Search, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/error-state";
import { apiDownload, apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { usePortalCertificates } from "@/lib/portal";
import { formatDate } from "@/lib/utils";
import type { Certificate } from "@/lib/types";
import { PageHeading, StatCard } from "@/features/dashboard/shared";
import { LoadingTable, StatusPill, TableEmpty } from "./shared";

export function CertificatesPage({ role }: { role: "teacher" | "admin" }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const certificates = usePortalCertificates();
  const [search, setSearch] = useState("");
  const [toRevoke, setToRevoke] = useState<Certificate | null>(null);
  const [reason, setReason] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: ({ certificate, reason }: { certificate: Certificate; reason: string }) =>
      apiRequest(`/api/certificates/${certificate.certificate_id}/revoke/`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: () => {
      toast.success(t("portal.saved"));
      setToRevoke(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["portal", "certificates"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const download = async (certificate: Certificate) => {
    setDownloading(certificate.certificate_id);
    try {
      await apiDownload(
        `/api/certificates/${certificate.certificate_id}/download/`,
        `${certificate.certificate_id}.pdf`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("portal.errorOccurred"));
    } finally {
      setDownloading(null);
    }
  };

  const items = useMemo(() => certificates.data?.results ?? [], [certificates.data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((certificate) => {
      return (
        certificate.certificate_id.toLowerCase().includes(query) ||
        certificate.student_name.toLowerCase().includes(query) ||
        certificate.course?.title?.toLowerCase().includes(query)
      );
    });
  }, [items, search]);

  if (certificates.isError) {
    return (
      <ErrorState
        message={certificates.error instanceof Error ? certificates.error.message : undefined}
        onRetry={() => certificates.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow={role === "teacher" ? t("teacher.title") : t("admin.title")}
        title={t("portal.certificates")}
        subtitle={role === "teacher" ? t("teacher.certificates") : t("admin.subtitle")}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Award} label={t("portal.certificates")} value={items.length} />
        <StatCard
          icon={Award}
          label={t("portal.activeOnly")}
          value={items.filter((certificate) => !certificate.revoked).length}
          tone="emerald"
        />
        <StatCard
          icon={ShieldOff}
          label={t("verify.revoked")}
          value={items.filter((certificate) => certificate.revoked).length}
          tone="gold"
        />
      </div>

      <div className="surface mb-4 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("verify.inputLabel")}
            className="pl-9"
          />
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t("portal.certificate")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.student")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.course")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.date")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.status")}</th>
                <th className="px-3 py-3 text-right font-semibold">{t("portal.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {certificates.isLoading ? (
                <LoadingTable rows={6} columns={6} />
              ) : filtered.length ? (
                filtered.map((certificate) => (
                  <tr key={certificate.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-medium">{certificate.certificate_id}</p>
                      <Link
                        href={`/verify/certificate/${certificate.certificate_id}`}
                        target="_blank"
                        className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        {t("verify.title")}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-3 py-3">{certificate.student_name}</td>
                    <td className="px-3 py-3">
                      <p className="max-w-[220px] truncate">{certificate.course?.title}</p>
                      <p className="text-[11px] text-muted-foreground">{certificate.teacher_name}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(certificate.issued_at, lang)}</td>
                    <td className="px-3 py-3">
                      <StatusPill status={certificate.revoked ? "failed" : "active"} />
                      {certificate.revoked && certificate.revoked_reason ? (
                        <p className="mt-0.5 max-w-[160px] truncate text-[11px] text-muted-foreground">
                          {certificate.revoked_reason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="iconSm"
                          title={t("common.download")}
                          onClick={() => download(certificate)}
                          disabled={downloading === certificate.certificate_id}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {role === "admin" && !certificate.revoked ? (
                          <Button
                            variant="ghost"
                            size="iconSm"
                            className="text-destructive hover:text-destructive"
                            title={t("portal.revoke")}
                            onClick={() => setToRevoke(certificate)}
                          >
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <TableEmpty colSpan={6}>{search ? t("common.noResults") : t("portal.noCertificates")}</TableEmpty>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(toRevoke)} onOpenChange={(open) => !open && setToRevoke(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("portal.revoke")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("portal.revokeConfirm")}</p>
            <p className="font-mono text-xs">{toRevoke?.certificate_id}</p>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("portal.reasonPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToRevoke(null)} disabled={revoke.isPending}>
              {t("portal.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => toRevoke && revoke.mutate({ certificate: toRevoke, reason })}
              disabled={revoke.isPending}
            >
              {t("portal.revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
