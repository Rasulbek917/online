"use client";

import Link from "next/link";
import {
  Award,
  BookOpen,
  Gem,
  GraduationCap,
  MessagesSquare,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { usePublicStats } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

export function AboutPage() {
  const { t } = useI18n();
  const stats = usePublicStats();
  const data = stats.data;

  const numbers = [
    { icon: Users, label: t("home.trustStudents"), value: data?.students },
    { icon: BookOpen, label: t("home.trustCourses"), value: data?.courses },
    { icon: Video, label: t("home.trustLessons"), value: data?.lessons },
    { icon: Award, label: t("home.trustCertificates"), value: data?.certificates },
  ];

  const values = [
    { icon: Target, ...tPair(t, "about.values.practicalTitle", "about.values.practicalText") },
    { icon: Gem, ...tPair(t, "about.values.qualityTitle", "about.values.qualityText") },
    { icon: MessagesSquare, ...tPair(t, "about.values.supportTitle", "about.values.supportText") },
    { icon: TrendingUp, ...tPair(t, "about.values.resultTitle", "about.values.resultText") },
  ];

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-hero-glow" />
      <div className="container relative max-w-6xl py-12 lg:py-16">
        <section className="mx-auto max-w-3xl text-center">
          <Badge variant="default" className="mb-4 gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            {t("about.badge")}
          </Badge>
          <h1 className="text-balance font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {t("about.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("about.subtitle")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild variant="gradient" size="lg">
              <Link href="/courses">{t("home.ctaCourses")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/register">{t("home.ctaButton")}</Link>
            </Button>
          </div>
        </section>

        <section className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {numbers.map((item) => (
            <div key={item.label} className="surface flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {typeof item.value === "number" ? formatNumber(item.value) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-14 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <Badge variant="muted" className="mb-3">
              {t("about.missionTitle")}
            </Badge>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {t("about.missionTitle")}
            </h2>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("about.missionText")}
            </p>
            <div className="mt-6 space-y-2.5">
              {[t("home.benefits.videoTitle"), t("home.benefits.quizTitle"), t("home.benefits.certTitle")].map(
                (item) => (
                  <p key={item} className="flex items-center gap-2.5 text-sm">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </p>
                ),
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/15 via-card to-card p-8">
            <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-2xl" />
            <div className="relative">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-amber-500 text-white shadow-lg shadow-gold/20">
                <Award className="h-7 w-7" />
              </span>
              <h3 className="mt-5 font-display text-xl font-bold">{t("home.certificateTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("home.certificateSubtitle")}</p>
              <Button asChild variant="gold" className="mt-5">
                <Link href="/verify/certificate">{t("home.certificateCta")}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {t("about.valuesTitle")}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <div key={value.title} className="surface p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <value.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{value.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{value.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/15 via-card to-brand-2/15 p-8 text-center sm:p-12">
          <Rocket className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-4 font-display text-2xl font-bold sm:text-3xl">{t("about.ctaTitle")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{t("about.ctaText")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="gradient">
              <Link href="/courses">{t("home.ctaCourses")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register">{t("home.ctaButton")}</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function tPair(t: (key: string) => string, titleKey: string, textKey: string) {
  return { title: t(titleKey), text: t(textKey) };
}
