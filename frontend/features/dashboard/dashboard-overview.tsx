"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Award,
  BookOpen,
  ChevronRight,
  CircleDollarSign,
  Flame,
  GraduationCap,
  PlayCircle,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useContinueLearning, useStudentDashboard } from "@/lib/queries";
import { mediaUrl } from "@/lib/api";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import {
  EmptyPanel,
  PageHeading,
  SectionPanel,
  StatCard,
} from "./shared";

export function DashboardOverview() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const dashboard = useStudentDashboard();
  const continuing = useContinueLearning();

  if (dashboard.isError) {
    return (
      <ErrorState
        message={dashboard.error instanceof Error ? dashboard.error.message : undefined}
        onRetry={() => dashboard.refetch()}
      />
    );
  }

  const data = dashboard.data;
  const summary = data?.summary;
  const loading = dashboard.isLoading;
  const items = continuing.data?.results ?? [];
  const first = items[0];
  const rest = items.slice(1, 4);
  const enrollments = data?.enrollments ?? [];

  return (
    <div>
      <PageHeading
        eyebrow={t("dashboard.title")}
        title={t("dashboard.welcome", { name: user?.first_name || user?.full_name || "" })}
        subtitle={t("dashboard.subtitle")}
        actions={
          <Button asChild variant="gradient">
            <Link href="/courses">
              <BookOpen className="h-4 w-4" />
              {t("dashboard.browseCourses")}
            </Link>
          </Button>
        }
      />

      <section className="surface relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-brand-2/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="mr-1 h-3 w-3" />
              {t("brand")}
            </Badge>
            <h2 className="mt-3 text-xl font-bold sm:text-2xl">{t("dashboard.continueTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {first ? t("dashboard.continueHint") : t("dashboard.noContinueHint")}
            </p>
            {first ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-medium">{first.course.title}</span>
                  <span className="shrink-0 text-muted-foreground">{first.percent}%</span>
                </div>
                <Progress value={first.percent} className="h-2" />
                <p className="truncate text-xs text-muted-foreground">
                  {lang === "ru" ? first.lesson_title_ru : first.lesson_title_uz}
                </p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {first ? (
                first.lesson_url ? (
                  <Button asChild variant="gradient" size="sm">
                    <Link href={first.lesson_url}>
                      <PlayCircle className="h-4 w-4" />
                      {t("common.continueLearning")}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="gradient" size="sm">
                    <Link href={`/courses/${first.course.slug}`}>
                      {t("dashboard.renewNow")}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )
              ) : (
                <Button asChild variant="gradient" size="sm">
                  <Link href="/courses">{t("dashboard.browseCourses")}</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/courses">{t("dashboard.myCourses")}</Link>
              </Button>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            <HeroMetric
              icon={Flame}
              label={t("dashboard.points")}
              value={loading ? "…" : formatNumber(summary?.points ?? 0)}
            />
            <HeroMetric
              icon={Trophy}
              label={t("dashboard.rank")}
              value={loading ? "…" : summary?.rank ? `#${summary.rank}` : "—"}
            />
            <HeroMetric
              icon={Award}
              label={t("dashboard.certificates")}
              value={loading ? "…" : formatNumber(summary?.certificates ?? 0)}
            />
            <HeroMetric
              icon={Target}
              label={t("dashboard.inProgress")}
              value={loading ? "…" : formatNumber(summary?.in_progress_courses ?? 0)}
            />
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={BookOpen}
          label={t("dashboard.enrolledCourses")}
          value={loading ? "…" : formatNumber(summary?.enrolled_courses ?? 0)}
          href="/dashboard/courses"
        />
        <StatCard
          icon={Target}
          label={t("dashboard.inProgress")}
          value={loading ? "…" : formatNumber(summary?.in_progress_courses ?? 0)}
          tone="violet"
          href="/dashboard/courses"
        />
        <StatCard
          icon={GraduationCap}
          label={t("dashboard.completedCourses")}
          value={loading ? "…" : formatNumber(summary?.completed_courses ?? 0)}
          tone="emerald"
          href="/dashboard/courses"
        />
        <StatCard
          icon={Award}
          label={t("dashboard.certificates")}
          value={loading ? "…" : formatNumber(summary?.certificates ?? 0)}
          tone="gold"
          href="/dashboard/certificates"
        />
        <StatCard
          icon={Flame}
          label={t("dashboard.points")}
          value={loading ? "…" : formatNumber(summary?.points ?? 0)}
          tone="primary"
          href="/dashboard/leaderboard"
        />
        <StatCard
          icon={Trophy}
          label={t("dashboard.rank")}
          value={loading ? "…" : summary?.rank ? `#${summary.rank}` : "—"}
          tone="violet"
          href="/dashboard/leaderboard"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <SectionPanel
          title={t("dashboard.continueTitle")}
          icon={PlayCircle}
          action={{ href: "/dashboard/courses", label: t("dashboard.viewAll") }}
        >
          {continuing.isLoading ? (
            <div className="space-y-3">
              {[0, 1].map((index) => (
                <div key={index} className="skeleton h-20 rounded-xl" />
              ))}
            </div>
          ) : rest.length === 0 ? (
            <EmptyPanel
              icon={BookOpen}
              title={first ? t("dashboard.noCourses") : t("dashboard.noContinue")}
              hint={t("dashboard.noContinueHint")}
            />
          ) : (
            <ul className="space-y-2.5">
              {rest.map((item) => (
                <li key={item.course.id}>
                  <Link
                    href={item.lesson_url || `/courses/${item.course.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-border/70 p-2.5 transition-colors hover:border-primary/30 hover:bg-secondary/40"
                  >
                    <CourseThumb course={item.course} className="h-14 w-20 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold group-hover:text-primary">{item.course.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lang === "ru" ? item.lesson_title_ru : item.lesson_title_uz}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={item.percent} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground">{item.percent}%</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel
          title={t("dashboard.myCourses")}
          icon={BookOpen}
          action={{ href: "/dashboard/courses", label: t("dashboard.viewAll") }}
        >
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="skeleton h-14 rounded-xl" />
              ))}
            </div>
          ) : enrollments.length === 0 ? (
            <EmptyPanel icon={BookOpen} title={t("dashboard.noCourses")} hint={t("dashboard.noCoursesHint")} />
          ) : (
            <ul className="space-y-2.5">
              {enrollments.slice(0, 4).map((enrollment) => (
                <li key={enrollment.id}>
                  <Link
                    href={
                      enrollment.next_lesson_id
                        ? `/learn/${enrollment.course.slug}/${enrollment.next_lesson_id}`
                        : `/courses/${enrollment.course.slug}`
                    }
                    className="flex items-center gap-3 rounded-xl border border-border/70 p-2.5 transition-colors hover:border-primary/30 hover:bg-secondary/40"
                  >
                    <CourseThumb course={enrollment.course} className="h-12 w-16 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{enrollment.course.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Progress value={enrollment.progress_percent} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground">{enrollment.progress_percent}%</span>
                      </div>
                    </div>
                    {enrollment.completed_at ? (
                      <Badge variant="success" className="shrink-0 px-1.5 py-0 text-[10px]">
                        {t("common.completed")}
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SectionPanel
          title={t("dashboard.recentCertificates")}
          icon={Award}
          action={{ href: "/dashboard/certificates", label: t("dashboard.viewAll") }}
        >
          {loading ? (
            <div className="skeleton h-24 rounded-xl" />
          ) : (data?.certificates.length ?? 0) === 0 ? (
            <EmptyPanel icon={Award} title={t("dashboard.noCertificates")} hint={t("dashboard.noCertificatesHint")} />
          ) : (
            <ul className="space-y-2">
              {data?.certificates.slice(0, 3).map((certificate) => (
                <li key={certificate.id}>
                  <Link
                    href={`/verify/certificate/${certificate.certificate_id}`}
                    className="flex items-center gap-2.5 rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 transition-colors hover:bg-gold/10"
                  >
                    <Award className="h-4 w-4 shrink-0 text-gold" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{certificate.course.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{formatDate(certificate.issued_at, lang)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel
          title={t("dashboard.quizResults")}
          icon={Target}
          action={{ href: "/dashboard/courses", label: t("dashboard.viewAll") }}
        >
          {loading ? (
            <div className="skeleton h-24 rounded-xl" />
          ) : (data?.quiz_attempts.length ?? 0) === 0 ? (
            <EmptyPanel icon={Target} title={t("dashboard.noQuizResults")} hint={t("dashboard.noQuizResultsHint")} />
          ) : (
            <ul className="space-y-2">
              {data?.quiz_attempts.slice(0, 3).map((attempt) => (
                <li key={attempt.id}>
                  <Link
                    href={`/courses/${attempt.course_slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 transition-colors hover:border-primary/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{attempt.quiz.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {attempt.correct_count}/{attempt.total_questions} · {formatDate(attempt.started_at, lang)}
                      </p>
                    </div>
                    <Badge variant={attempt.passed ? "success" : "destructive"} className="shrink-0 px-1.5 py-0 text-[10px]">
                      {attempt.passed ? t("learn.passed") : t("learn.failed")}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel
          title={t("dashboard.recentPayments")}
          icon={CircleDollarSign}
          action={{ href: "/dashboard/payments", label: t("dashboard.viewAll") }}
          className="md:col-span-2 xl:col-span-1"
        >
          {loading ? (
            <div className="skeleton h-24 rounded-xl" />
          ) : (data?.payments.length ?? 0) === 0 ? (
            <EmptyPanel icon={CircleDollarSign} title={t("dashboard.noPayments")} hint={t("dashboard.noPaymentsHint")} />
          ) : (
            <ul className="space-y-2">
              {data?.payments.slice(0, 3).map((payment) => (
                <li key={payment.id}>
                  <Link
                    href="/dashboard/payments"
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 transition-colors hover:border-primary/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{payment.course.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {payment.provider_label} · {formatDate(payment.created_at, lang)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold">{formatMoney(payment.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>

      {!loading && (summary?.enrolled_courses ?? 0) === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={GraduationCap}
            title={t("dashboard.noCourses")}
            description={t("dashboard.noCoursesHint")}
            actionLabel={t("dashboard.browseCourses")}
          />
        </div>
      ) : null}
    </div>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 text-primary" />
        {label}
      </div>
      <p className="mt-1 text-lg font-bold leading-none">{value}</p>
    </div>
  );
}

export function CourseThumb({
  course,
  className,
}: {
  course: { thumbnail: string | null; title: string };
  className?: string;
}) {
  const src = mediaUrl(course.thumbnail);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-primary/15 via-secondary to-brand-2/10",
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={course.title} fill sizes="120px" className="object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center">
          <BookOpen className="h-4 w-4 text-primary/50" />
        </span>
      )}
    </div>
  );
}
