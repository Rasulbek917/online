"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CreditCard,
  ExternalLink,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { usePayments, useSubscriptions } from "@/lib/queries";
import { formatDate, formatDateTime, formatMoney, getErrorMessage } from "@/lib/utils";
import type { Payment, Subscription } from "@/lib/types";
import { PageHeading, SectionPanel } from "./shared";

const statusVariant: Record<Payment["status"], "success" | "warning" | "destructive" | "muted" | "default"> = {
  success: "success",
  pending: "warning",
  processing: "warning",
  failed: "destructive",
  canceled: "muted",
  refunded: "muted",
};

export function PaymentsPage() {
  const { t, lang } = useI18n();
  const payments = usePayments();
  const subscriptions = useSubscriptions();
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);

  const cancel = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/subscriptions/${id}/cancel/`, { method: "POST" }),
    onSuccess: () => {
      setCancelTarget(null);
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
      toast.success(t("common.success"));
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  if (payments.isError) {
    return <ErrorState onRetry={() => payments.refetch()} />;
  }

  const active = (subscriptions.data?.results ?? []).filter(
    (item) => item.status === "active" || item.status === "grace",
  );
  const rows = payments.data?.results ?? [];

  return (
    <div>
      <PageHeading
        eyebrow={t("dashboard.account")}
        title={t("payments.title")}
        subtitle={t("payments.subtitle")}
      />

      {active.length > 0 ? (
        <SectionPanel title={t("subscriptions.title")} icon={ShieldCheck} className="mb-5">
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((subscription) => (
              <div key={subscription.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/courses/${subscription.course.slug}`}
                      className="line-clamp-1 text-sm font-semibold hover:text-primary"
                    >
                      {subscription.course.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("subscriptions.periodEnd")}: {formatDate(subscription.current_period_end, lang)}
                    </p>
                  </div>
                  <Badge variant={subscription.status === "grace" ? "warning" : "success"}>
                    {subscription.status === "grace" ? t("subscriptions.grace") : t("subscriptions.active")}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {t("subscriptions.daysLeft", { n: subscription.days_remaining })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/courses/${subscription.course.slug}`}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t("subscriptions.renew")}
                      </Link>
                    </Button>
                    {subscription.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setCancelTarget(subscription)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t("subscriptions.cancel")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {subscription.status === "grace" ? (
                  <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    {t("subscriptions.graceNote")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      <section className="surface overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
          <ReceiptText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t("payments.history")}</h2>
          <Badge variant="muted" className="ml-1">
            {payments.data?.count ?? 0}
          </Badge>
        </div>

        {payments.isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={t("payments.noPayments")}
            description={t("payments.noPaymentsHint")}
            className="border-0"
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("payments.course")}</TableHead>
                    <TableHead>{t("payments.provider")}</TableHead>
                    <TableHead>{t("payments.period")}</TableHead>
                    <TableHead>{t("payments.amount")}</TableHead>
                    <TableHead>{t("payments.status")}</TableHead>
                    <TableHead>{t("payments.date")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="max-w-[240px]">
                        <Link
                          href={`/courses/${payment.course.slug}`}
                          className="line-clamp-1 font-medium hover:text-primary"
                        >
                          {payment.course.title}
                        </Link>
                      </TableCell>
                      <TableCell>{payment.provider_label}</TableCell>
                      <TableCell>
                        {payment.billing_period === "monthly" ? t("payments.monthly") : t("payments.full")}
                      </TableCell>
                      <TableCell className="font-semibold">{formatMoney(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[payment.status]}>
                          {t(`payments.statuses.${payment.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(payment.created_at, lang)}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.status === "pending" && payment.checkout_url ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={payment.checkout_url} target="_blank" rel="noopener noreferrer">
                              {t("payments.openPayment")}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {payment.paid_at ? formatDate(payment.paid_at, lang) : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border/70 md:hidden">
              {rows.map((payment) => (
                <li key={payment.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/courses/${payment.course.slug}`}
                      className="line-clamp-2 text-sm font-semibold hover:text-primary"
                    >
                      {payment.course.title}
                    </Link>
                    <Badge variant={statusVariant[payment.status]} className="shrink-0">
                      {t(`payments.statuses.${payment.status}`)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{payment.provider_label}</span>
                    <span className="font-semibold text-foreground">{formatMoney(payment.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{formatDateTime(payment.created_at, lang)}</span>
                    {payment.status === "pending" && payment.checkout_url ? (
                      <a
                        href={payment.checkout_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary"
                      >
                        {t("payments.openPayment")}
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("subscriptions.cancel")}</DialogTitle>
            <DialogDescription>{t("subscriptions.cancelConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => cancelTarget && cancel.mutate(cancelTarget.id)}
            >
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
