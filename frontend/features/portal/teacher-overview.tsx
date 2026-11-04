"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  CircleDollarSign,
  GraduationCap,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/shared/error-state";
import { useI18n } from "@/lib/i18n";
import { useTeacherAnalytics } from "@/lib/queries";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { PageHeading, SectionPanel, StatCard } from "@/features/dashboard/shared";
import { RangeTabs, RevenueChart, StatusPill, TableEmpty, type RangeKey } from "./shared";

export function TeacherOverview() {
  const { t, lang } = useI18n();
  const [range, setRange] = useState<RangeKey>("30d");
  const analytics = useTeacherAnalytics(range);
  const data = analytics.data;
  const summary = data?.summary;
  const loading = analytics.isLoading;

  if (analytics.isError) {
    return (
      <ErrorState
        message={analytics.error instanceof Error ? analytics.error.message : undefined}
        onRetry={() => analytics.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow={t("teacher.title")}
        title={t("teacher.dashboard")}
        subtitle={t("teacher.subtitle")}
        actions={
          <>
            <RangeTabs value={range} onChange={setRange} />
            <Button asChild variant="gradient">
              <Link href="/teacher/courses">
                <BookOpen className="h-4 w-4" />
                {t("teacher.myCourses")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={BookOpen}
          label={t("teacher.courses")}
          value={loading ? "…" : formatNumber(summary?.courses ?? 0)}
          hint={`${formatNumber(summary?.published_courses ?? 0)} ${t("teacher.published").toLowerCase()}`}
          href="/teacher/courses"
        />
        <StatCard
          icon={Users}
          label={t("teacher.students")}
          value={loading ? "…" : formatNumber(summary?.students ?? 0)}
          tone="violet"
          href="/teacher/students"
        />
        <StatCard
          icon={CircleDollarSign}
          label={`${t("teacher.revenue")} (${t("teacher.analyticsRange").toLowerCase()})`}
          value={loading ? "…" : formatMoney(summary?.revenue_in_range ?? 0)}
          tone="gold"
          href="/teacher/payments"
        />
        <StatCard
          icon={CircleDollarSign}
          label={t("admin.totalRevenue")}
          value={loading ? "…" : formatMoney(summary?.revenue ?? 0)}
          tone="emerald"
          href="/teacher/payments"
        />
        <StatCard
          icon={Target}
          label={t("teacher.completionRate")}
          value={loading ? "…" : `${summary?.completion_rate ?? 0}%`}
          tone="primary"
        />
        <StatCard
          icon={BarChart3}
          label={t("teacher.quizSuccess")}
          value={loading ? "…" : `${summary?.quiz_success_rate ?? 0}%`}
          tone="violet"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <SectionPanel title={t("admin.revenueChart")} icon={BarChart3}>
          {data?.series?.length ? (
            <RevenueChart data={data.series} />
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              {t("portal.noData")}
            </div>
          )}
        </SectionPanel>

        <SectionPanel title={t("teacher.recentPayments")} icon={CircleDollarSign} action={{ href: "/teacher/payments", label: t("common.viewAll") }}>
          {data?.recent_payments?.length ? (
            <ul className="divide-y divide-border/60">
              {data.recent_payments.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payment.course?.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {payment.user_name || payment.user_email || "—"} · {formatDate(payment.paid_at || payment.created_at, lang)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{formatMoney(payment.amount)}</p>
                    <StatusPill status={payment.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("portal.noPayments")}</p>
          )}
        </SectionPanel>
      </div>

      <div className="mt-4">
        <SectionPanel title={t("teacher.courseAnalytics")} icon={GraduationCap} action={{ href: "/teacher/courses", label: t("portal.allCourses") }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">{t("portal.course")}</th>
                  <th className="px-3 py-2 font-semibold">{t("teacher.studentsCount")}</th>
                  <th className="px-3 py-2 font-semibold">{t("teacher.completion")}</th>
                  <th className="px-3 py-2 font-semibold">{t("teacher.avgProgress")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("teacher.revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableEmpty colSpan={5}>{t("common.loading")}</TableEmpty>
                ) : data?.courses?.length ? (
                  data.courses.map((row) => (
                    <tr key={row.course.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-3">
                        <Link href={`/teacher/courses/${row.course.slug}`} className="font-medium hover:text-primary">
                          {row.course.title}
                        </Link>
                        <div className="mt-0.5">
                          <StatusPill status={row.course.status} />
                        </div>
                      </td>
                      <td className="px-3 py-3">{formatNumber(row.students)}</td>
                      <td className="px-3 py-3">{formatNumber(row.completed)}</td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-[110px] items-center gap-2">
                          <Progress value={row.avg_progress} className="h-1.5 w-20" />
                          <span className="text-xs text-muted-foreground">{Math.round(row.avg_progress)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium">{formatMoney(row.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <TableEmpty colSpan={5}>{t("portal.noCourses")}</TableEmpty>
                )}
              </tbody>
            </table>
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}
