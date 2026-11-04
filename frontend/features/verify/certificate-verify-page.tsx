"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Hash,
  Loader2,
  QrCode,
  Search,
  ShieldCheck,
  ShieldX,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useVerifyCertificate } from "@/lib/queries";
import { cn, formatDate } from "@/lib/utils";
import type { CertificateVerification } from "@/lib/types";

export function CertificateVerifyPage({ initialId }: { initialId?: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState(initialId || "");
  const [submitted, setSubmitted] = useState(initialId || "");

  useEffect(() => {
    if (initialId) {
      setValue(initialId);
      setSubmitted(initialId);
    }
  }, [initialId]);

  const query = useVerifyCertificate(submitted || null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = value.trim();
    if (!id) return;
    router.push(`/verify/certificate/${encodeURIComponent(id)}`);
  };

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-hero-glow" />
      <div className="container relative max-w-4xl py-10 lg:py-14">
        <div className="text-center">
          <Badge variant="gold" className="mb-4 gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("verify.title")}
          </Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("verify.title")}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{t("verify.subtitle")}</p>
        </div>

        <form onSubmit={submit} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={t("verify.placeholder")}
              className="pl-9"
              aria-label={t("verify.inputLabel")}
            />
          </div>
          <Button type="submit" variant="gradient" disabled={!value.trim()} className="sm:w-36">
            <Search />
            {t("verify.check")}
          </Button>
        </form>

        <p className="mx-auto mt-3 flex max-w-xl items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <QrCode className="h-3.5 w-3.5" />
          {t("verify.scanHint")}
        </p>

        {submitted && (
          <div className="mt-8">
            {query.isLoading ? (
              <div className="surface space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : query.isError || !query.data ? (
              <div className="flex flex-col items-center rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <ShieldX className="h-7 w-7" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{t("verify.invalid")}</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("verify.error")}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setSubmitted("")}>
                  {t("verify.another")}
                </Button>
              </div>
            ) : (
              <CertificateCard
                data={query.data}
                lang={lang}
                onReset={() => {
                  setSubmitted("");
                  setValue("");
                  router.push("/verify/certificate");
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CertificateCard({
  data,
  lang,
  onReset,
}: {
  data: CertificateVerification;
  lang: "uz" | "ru";
  onReset: () => void;
}) {
  const { t } = useI18n();
  const valid = data.valid && !data.revoked;
  const courseTitle = lang === "ru" ? data.course_title_ru : data.course_title_uz;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border-2 bg-gradient-to-br p-1 shadow-card",
        valid ? "border-gold/50 from-gold/15 via-card to-card" : "border-destructive/30 from-destructive/10 via-card to-card",
      )}
    >
      <div className="rounded-[1.35rem] bg-card/80 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                valid ? "bg-gold/15 text-gold" : "bg-destructive/10 text-destructive",
              )}
            >
              {valid ? <BadgeCheck className="h-6 w-6" /> : <ShieldX className="h-6 w-6" />}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                IT PARK ACADEMY
              </p>
              <h2 className="font-display text-lg font-bold">{valid ? t("verify.valid") : t("verify.invalid")}</h2>
            </div>
          </div>
          <Badge variant={valid ? "success" : "destructive"} className="gap-1.5">
            {valid ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" />}
            {data.revoked ? t("verify.revoked") : data.valid ? t("verify.valid") : t("verify.invalid")}
          </Badge>
        </div>

        <div className="mt-6 rounded-2xl border border-gold/25 bg-gold/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <Award className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="text-xs text-muted-foreground">{t("verify.course")}</p>
              <p className="font-display text-xl font-bold">{courseTitle}</p>
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <CertificateField icon={User} label={t("verify.student")} value={data.student_name} />
          <CertificateField icon={BookOpen} label={t("verify.teacher")} value={data.teacher_name} />
          <CertificateField
            icon={CalendarDays}
            label={t("verify.issued")}
            value={formatDate(data.issued_at, lang)}
          />
          <CertificateField icon={Hash} label={t("verify.certificateId")} value={data.certificate_id} mono />
          <CertificateField
            icon={Users}
            label={t("verify.verifications")}
            value={String(data.verifications_count)}
          />
        </dl>

        {data.revoked && data.revoked_reason && (
          <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm">
            <p className="text-xs font-medium text-destructive">{t("verify.revokedReason")}</p>
            <p className="mt-0.5 text-muted-foreground">{data.revoked_reason}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
          <p className="text-xs text-muted-foreground">
            {t("footer.rights")} © {new Date().getFullYear()} IT PARK ACADEMY
          </p>
          <Button variant="outline" size="sm" onClick={onReset}>
            <Search />
            {t("verify.another")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CertificateField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof User;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={cn("break-words text-sm font-medium", mono && "font-mono text-xs")}>{value}</dd>
      </div>
    </div>
  );
}
