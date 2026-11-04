"use client";

import { type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
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
import { useI18n } from "@/lib/i18n";
import { cn, formatMoney } from "@/lib/utils";
import type { SeriesPoint } from "@/lib/types";

export const RANGE_OPTIONS = ["today", "7d", "30d", "90d", "1y"] as const;
export type RangeKey = (typeof RANGE_OPTIONS)[number];

export function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (value: RangeKey) => void }) {
  const { t } = useI18n();
  const labels: Record<RangeKey, string> = {
    today: t("teacher.today"),
    "7d": t("teacher.last7"),
    "30d": t("teacher.last30"),
    "90d": t("teacher.last90"),
    "1y": t("teacher.lastYear"),
  };
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-secondary/30 p-1">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            value === option && "bg-primary/15 text-primary",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

export function RevenueChart({ data, height = 260 }: { data: SeriesPoint[]; height?: number }) {
  const { lang } = useI18n();
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portalRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="portalEnrollments" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#94a3b8" strokeOpacity={0.2} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(value) => (Number(value) >= 1000 ? `${Math.round(Number(value) / 1000)}k` : String(value))}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value, name) => [
              name === "revenue"
                ? formatMoney(Number(value))
                : Number(value).toLocaleString(lang === "ru" ? "ru-RU" : "uz-UZ"),
              name === "revenue" ? "Daromad" : "Yozilishlar",
            ]}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#portalRevenue)"
          />
          <Area
            type="monotone"
            dataKey="enrollments"
            stroke="#a855f7"
            strokeWidth={2}
            fill="url(#portalEnrollments)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  const tone: Record<string, string> = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    processing: "border-primary/30 bg-primary/10 text-primary",
    pending: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    grace: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    draft: "border-border bg-secondary/60 text-muted-foreground",
    archived: "border-border bg-secondary/60 text-muted-foreground",
    inactive: "border-border bg-secondary/60 text-muted-foreground",
    canceled: "border-border bg-secondary/60 text-muted-foreground",
    failed: "border-destructive/30 bg-destructive/10 text-destructive",
    expired: "border-destructive/30 bg-destructive/10 text-destructive",
    refunded: "border-border bg-secondary/60 text-muted-foreground",
  };
  const labels: Record<string, string> = {
    pending: t("payments.statuses.pending"),
    processing: t("payments.statuses.processing"),
    success: t("payments.statuses.success"),
    failed: t("payments.statuses.failed"),
    canceled: t("payments.statuses.canceled"),
    refunded: t("payments.statuses.refunded"),
    active: t("subscriptions.active"),
    grace: t("subscriptions.grace"),
    expired: t("subscriptions.expired"),
    inactive: t("portal.inactiveOnly"),
    published: t("portal.published"),
    draft: t("portal.draft"),
    archived: t("portal.archived"),
    revoked: t("portal.revoked"),
  };
  return (
    <Badge variant="outline" className={cn("font-medium", tone[status] || "border-border bg-secondary/60")}>
      {labels[status] || status}
    </Badge>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("portal.cancel")}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel || t("portal.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

export function LoadingTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-border/60">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex} className="px-3 py-3">
              <div className="skeleton h-4 w-full max-w-[180px] rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
