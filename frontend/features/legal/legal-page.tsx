"use client";

import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const UPDATED_AT = "2026-11-02";

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const { t } = useI18n();
  const isPrivacy = kind === "privacy";

  const sections = isPrivacy
    ? [
        ["dataTitle", "dataText"],
        ["useTitle", "useText"],
        ["securityTitle", "securityText"],
        ["rightsTitle", "rightsText"],
      ]
    : [
        ["accountTitle", "accountText"],
        ["paymentTitle", "paymentText"],
        ["conductTitle", "conductText"],
        ["terminationTitle", "terminationText"],
        ["securityTitle", "securityText"],
      ];

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-hero-glow" />
      <div className="container relative max-w-3xl py-10 lg:py-14">
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-6">
          <Link href="/">
            <ArrowLeft />
            {t("common.back")}
          </Link>
        </Button>

        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {isPrivacy ? <ShieldCheck className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {isPrivacy ? t("legal.privacyTitle") : t("legal.termsTitle")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("legal.updated")}: {UPDATED_AT}
            </p>
          </div>
        </div>

        <div className="surface mt-6 p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isPrivacy ? t("legal.privacyIntro") : t("legal.termsIntro")}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {sections.map(([titleKey, textKey], index) => (
            <section key={titleKey} className="surface p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <Badge variant="muted" className="h-6 w-6 justify-center rounded-full p-0 text-[11px]">
                  {index + 1}
                </Badge>
                <h2 className="font-display text-base font-semibold">
                  {t(`legal.sections.${titleKey}`)}
                </h2>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {t(`legal.sections.${textKey}`)}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-secondary/30 px-5 py-4 text-sm">
          <p className="text-muted-foreground">
            {isPrivacy ? t("legal.termsTitle") : t("legal.privacyTitle")}
          </p>
          <Button asChild variant="link" size="sm" className="px-0">
            <Link href={isPrivacy ? "/legal/terms" : "/legal/privacy"}>
              {isPrivacy ? t("footer.terms") : t("footer.privacy")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
