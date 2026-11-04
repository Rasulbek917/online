"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CircleDollarSign,
  CreditCard,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/shared/error-state";
import { useI18n } from "@/lib/i18n";
import { useAdminAnalytics } from "@/lib/queries";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { PageHeading, SectionPanel, StatCard } from "@/features/dashboard/shared";
import { RangeTabs, RevenueChart, StatusPill, TableEmpty, type RangeKey } from "./shared";

export function AdminOverview() {
  const { t, lang } = useI18n();
  const [range, setRange] = useState<RangeKey>("30d");
  const analytics = useAdminAnalytics(range);
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

  const providerTotal = (data?.providers ?? []).reduce((sum, item) => sum + item.total, 0);

  return (
    <div>
      <PageHeading
        eyebrow={t("admin.title")}
        title={t("admin.overview")}
        subtitle={t("admin.subtitle")}
        actions={
          <>
            <RangeTabs value={range} onChange={setRange} />
            <Button asChild variant="gradient">
              <Link href="/admin/courses">
                <BookOpen className="h-4 w-4" />
                {t("admin.courses")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Users}
          label={t("admin.totalStudents")}
          value={loading ? "…" : formatNumber(summary?.total_students ?? 0)}
          href="/admin/users"
        />
        <StatCard
          icon={CreditCard}
          label={t("admin.activeSubscriptions")}
          value={loading ? "…" : formatNumber(summary?.active_subscriptions ?? 0)}
          tone="violet"
        />
        <StatCard
          icon={BookOpen}
          label={t("admin.totalCourses")}
          value={loading ? "…" : formatNumber(summary?.total_courses ?? 0)}
          hint={`${formatNumber(summary?.published_courses ?? 0)} ${t("teacher.published").toLowerCase()}`}
          tone="emerald"
          href="/admin/courses"
        />
        <StatCard
          icon={AlertTriangle}
          label={t("admin.failedPayments")}
          value={loading ? "…" : formatNumber(summary?.failed_payments ?? 0)}
          tone="gold"
          href="/admin/payments"
        />
        <StatCard
          icon={Wallet}
          label={t("admin.totalRevenue")}
          value={loading ? "…" : formatMoney(summary?.total_revenue ?? 0)}
          tone="gold"
          href="/admin/payments"
        />
        <StatCard
          icon={CircleDollarSign}
          label={t("admin.monthlyRevenue")}
          value={loading ? "…" : formatMoney(summary?.monthly_revenue ?? 0)}
          tone="emerald"
          href="/admin/payments"
        />
        <StatCard
          icon={Target}
          label={t("admin.completionRate")}
          value={loading ? "…" : `${summary?.completion_rate ?? 0}%`}
          tone="primary"
        />
        <StatCard
          icon={BarChart3}
          label={t("admin.quizSuccess")}
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

        <SectionPanel title={t("admin.providers")} icon={CreditCard}>
          {data?.providers?.length ? (
            <ul className="space-y-4">
              {data.providers.map((provider) => (
                <li key={provider.provider}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium capitalize">{provider.provider}</span>
                    <span className="text-muted-foreground">
                      {formatMoney(provider.total)} · {provider.count}
                    </span>
                  </div>
                  <Progress
                    value={providerTotal ? (provider.total / providerTotal) * 100 : 0}
                    className="mt-1.5 h-1.5"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("portal.noData")}</p>
          )}
        </SectionPanel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionPanel title={t("admin.topCourses")} icon={BookOpen} action={{ href: "/admin/courses", label: t("common.viewAll") }}>
          {data?.top_courses?.length ? (
            <ul className="divide-y divide-border/60">
              {data.top_courses.map((course) => (
                <li key={course.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/courses/${course.slug}`} className="truncate text-sm font-medium hover:text-primary">
                      {course.title}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {course.teacher?.full_name} · {formatNumber(course.students_count)} {t("common.students")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{formatMoney(course.effective_monthly_price)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("portal.noCourses")}</p>
          )}
        </SectionPanel>

        <SectionPanel title={t("admin.recentPayments")} icon={CircleDollarSign} action={{ href: "/admin/payments", label: t("common.viewAll") }}>
          {data?.recent_payments?.length ? (
            <ul className="divide-y divide-border/60">
              {data.recent_payments.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payment.user_name || payment.user_email || "—"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {payment.course?.title} · {formatDate(payment.created_at, lang)}
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
        <SectionPanel title={t("admin.recentUsers")} icon={Users} action={{ href: "/admin/users", label: t("common.viewAll") }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">{t("portal.name")}</th>
                  <th className="px-3 py-2 font-semibold">{t("portal.role")}</th>
                  <th className="px-3 py-2 font-semibold">{t("portal.joined")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("portal.enrollments")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableEmpty colSpan={4}>{t("common.loading")}</TableEmpty>
                ) : data?.recent_users?.length ? (
                  data.recent_users.map((user) => (
                    <tr key={user.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-3">
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{user.email}</p>
                      </td>
                      <td className="px-3 py-3 capitalize">{t(`roles.${user.role}`)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDate(user.created_at, lang)}</td>
                      <td className="px-3 py-3 text-right">{formatNumber(user.enrollments_count)}</td>
                    </tr>
                  ))
                ) : (
                  <TableEmpty colSpan={4}>{t("portal.noUsers")}</TableEmpty>
                )}
              </tbody>
            </table>
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}
