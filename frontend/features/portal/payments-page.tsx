"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, CreditCard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/shared/error-state";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { usePortalPayments } from "@/lib/portal";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/utils";
import type { Payment } from "@/lib/types";
import { PageHeading, StatCard } from "@/features/dashboard/shared";
import { ConfirmDialog, LoadingTable, StatusPill, TableEmpty } from "./shared";

const PROVIDERS = ["click", "payme", "uzum", "sandbox", "manual"] as const;
const STATUSES = ["pending", "processing", "success", "failed", "canceled", "refunded"] as const;

export function PaymentsPage({ role }: { role: "teacher" | "admin" }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const payments = usePortalPayments();
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const [toConfirm, setToConfirm] = useState<Payment | null>(null);

  const markPaid = useMutation({
    mutationFn: (payment: Payment) =>
      apiRequest(`/api/payments/${payment.id}/mark_paid/`, { method: "POST", body: {} }),
    onSuccess: () => {
      toast.success(t("portal.markPaid"));
      setToConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "payments"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const items = useMemo(() => payments.data?.results ?? [], [payments.data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((payment) => {
      if (provider !== "all" && payment.provider !== provider) return false;
      if (status !== "all" && payment.status !== status) return false;
      if (!query) return true;
      return (
        payment.course?.title?.toLowerCase().includes(query) ||
        payment.user_name?.toLowerCase().includes(query) ||
        payment.user_email?.toLowerCase().includes(query) ||
        String(payment.id).includes(query)
      );
    });
  }, [items, provider, search, status]);

  const successTotal = items
    .filter((payment) => payment.status === "success")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingCount = items.filter((payment) => payment.status === "pending" || payment.status === "processing").length;

  if (payments.isError) {
    return (
      <ErrorState
        message={payments.error instanceof Error ? payments.error.message : undefined}
        onRetry={() => payments.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow={role === "teacher" ? t("teacher.title") : t("admin.title")}
        title={t("portal.payments")}
        subtitle={role === "teacher" ? t("teacher.subtitle") : t("admin.subtitle")}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={CreditCard} label={t("portal.totalTransactions", { n: formatNumber(items.length) })} value={formatNumber(items.length)} />
        <StatCard
          icon={CreditCard}
          label={t("portal.revenue")}
          value={formatMoney(successTotal)}
          tone="emerald"
        />
        <StatCard
          icon={CreditCard}
          label={`${t("portal.status")}: ${t("payments.statuses.pending")}`}
          value={formatNumber(pendingCount)}
          tone="gold"
        />
      </div>

      <div className="surface mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("portal.searchUsers")}
            className="pl-9"
          />
        </div>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("portal.allProviders")}</SelectItem>
            {PROVIDERS.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`payments.providers.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("portal.allStatuses")}</SelectItem>
            {STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`payments.statuses.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t("portal.course")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.student")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.provider")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.amount")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.status")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.date")}</th>
                {role === "admin" ? <th className="px-3 py-3 text-right font-semibold">{t("portal.actions")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {payments.isLoading ? (
                <LoadingTable rows={6} columns={role === "admin" ? 7 : 6} />
              ) : filtered.length ? (
                filtered.map((payment) => (
                  <tr key={payment.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="min-w-[180px] font-medium">{payment.course?.title ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">#{payment.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{payment.user_name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{payment.user_email || ""}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{t(`payments.providers.${payment.provider}`)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t(`portal.billingPeriods.${payment.billing_period}`)}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-medium">{formatMoney(payment.amount)}</td>
                    <td className="px-3 py-3">
                      <StatusPill status={payment.status} />
                      {payment.failure_reason ? (
                        <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-destructive">{payment.failure_reason}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {formatDateTime(payment.paid_at || payment.created_at, lang)}
                    </td>
                    {role === "admin" ? (
                      <td className="px-3 py-3 text-right">
                        {payment.status === "pending" || payment.status === "processing" ? (
                          <Button variant="outline" size="sm" onClick={() => setToConfirm(payment)}>
                            <BadgeCheck className="h-4 w-4" />
                            {t("portal.markPaid")}
                          </Button>
                        ) : payment.status === "success" && payment.provider_transaction_id ? (
                          <span className="text-[11px] text-muted-foreground">{payment.provider_transaction_id}</span>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <TableEmpty colSpan={role === "admin" ? 7 : 6}>
                  {search || provider !== "all" || status !== "all" ? t("common.noResults") : t("portal.noPayments")}
                </TableEmpty>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(toConfirm)}
        onOpenChange={(open) => !open && setToConfirm(null)}
        title={t("portal.markPaid")}
        description={t("portal.markPaidConfirm")}
        confirmLabel={t("portal.confirm")}
        destructive={false}
        loading={markPaid.isPending}
        onConfirm={() => toConfirm && markPaid.mutate(toConfirm)}
      />
    </div>
  );
}
