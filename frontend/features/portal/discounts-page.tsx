"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Percent, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ErrorState } from "@/components/shared/error-state";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useMyCourses } from "@/lib/queries";
import { usePortalDiscounts } from "@/lib/portal";
import { formatDateTime } from "@/lib/utils";
import type { Discount } from "@/lib/types";
import { PageHeading, StatCard } from "@/features/dashboard/shared";
import { ConfirmDialog, FilterField, LoadingTable, StatusPill, TableEmpty } from "./shared";

function toLocalInput(value: Date) {
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(
    value.getMinutes(),
  )}`;
}

export function DiscountsPage({ role = "teacher" }: { role?: "teacher" | "admin" }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const discounts = usePortalDiscounts();
  const courses = useMyCourses();
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Discount | null>(null);
  const [form, setForm] = useState(() => {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      course: "",
      percentage: "20",
      starts_at: toLocalInput(now),
      ends_at: toLocalInput(week),
      is_active: true,
    };
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["portal", "discounts"] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["course"] });
  };

  const create = useMutation({
    mutationFn: () =>
      apiRequest("/api/discounts/", {
        method: "POST",
        body: {
          course: Number(form.course),
          percentage: Number(form.percentage),
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: new Date(form.ends_at).toISOString(),
          is_active: form.is_active,
        },
      }),
    onSuccess: () => {
      toast.success(t("teacher.discountCreated"));
      setOpen(false);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const toggle = useMutation({
    mutationFn: (discount: Discount) =>
      apiRequest(`/api/discounts/${discount.id}/`, {
        method: "PATCH",
        body: { is_active: !discount.is_active },
      }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const remove = useMutation({
    mutationFn: (discount: Discount) => apiRequest(`/api/discounts/${discount.id}/`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("teacher.discountDeleted"));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const items = useMemo(() => discounts.data?.results ?? [], [discounts.data]);
  const now = Date.now();
  const activeCount = items.filter(
    (discount) =>
      discount.is_active &&
      new Date(discount.starts_at).getTime() <= now &&
      new Date(discount.ends_at).getTime() >= now,
  ).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.course || !form.percentage || !form.starts_at || !form.ends_at) {
      toast.error(t("portal.requiredFields"));
      return;
    }
    create.mutate();
  };

  if (discounts.isError) {
    return (
      <ErrorState
        message={discounts.error instanceof Error ? discounts.error.message : undefined}
        onRetry={() => discounts.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow={role === "teacher" ? t("teacher.title") : t("admin.title")}
        title={t("teacher.discounts")}
        subtitle={role === "teacher" ? t("teacher.subtitle") : t("admin.subtitle")}
        actions={
          <Button variant="gradient" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("teacher.createDiscount")}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Percent} label={t("teacher.discounts")} value={items.length} />
        <StatCard icon={Percent} label={t("portal.activeOnly")} value={activeCount} tone="emerald" />
        <StatCard
          icon={Percent}
          label={t("portal.inactiveOnly")}
          value={items.length - activeCount}
          tone="gold"
        />
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t("portal.course")}</th>
                <th className="px-3 py-3 font-semibold">{t("teacher.discountPercent")}</th>
                <th className="px-3 py-3 font-semibold">{t("teacher.startsAt")}</th>
                <th className="px-3 py-3 font-semibold">{t("teacher.endsAt")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.status")}</th>
                <th className="px-3 py-3 text-right font-semibold">{t("portal.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {discounts.isLoading ? (
                <LoadingTable rows={5} columns={6} />
              ) : items.length ? (
                items.map((discount) => (
                  <tr key={discount.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium">{lang === "ru" ? discount.course_title_ru : discount.course_title}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-lg bg-gold/15 px-2 py-1 text-xs font-semibold text-gold">
                        -{discount.percentage}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {formatDateTime(discount.starts_at, lang)}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {formatDateTime(discount.ends_at, lang)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={discount.is_current ? "active" : discount.is_active ? "pending" : "inactive"} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={discount.is_active}
                          onCheckedChange={() => toggle.mutate(discount)}
                          disabled={toggle.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="iconSm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setToDelete(discount)}
                          title={t("portal.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <TableEmpty colSpan={6}>{t("teacher.noDiscounts")}</TableEmpty>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("teacher.createDiscount")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submit}>
            <FilterField label={t("portal.course")}>
              <Select value={form.course} onValueChange={(value) => setForm((prev) => ({ ...prev, course: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("portal.chooseCourse")} />
                </SelectTrigger>
                <SelectContent>
                  {(courses.data?.results ?? []).map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label={t("teacher.discountPercent")}>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.percentage}
                onChange={(event) => setForm((prev) => ({ ...prev, percentage: event.target.value }))}
              />
            </FilterField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FilterField label={t("teacher.startsAt")}>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
                />
              </FilterField>
              <FilterField label={t("teacher.endsAt")}>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
                />
              </FilterField>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5 text-sm">
              <span>{t("teacher.discountActive")}</span>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
                {t("portal.cancel")}
              </Button>
              <Button type="submit" variant="gradient" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("portal.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("portal.delete")}
        description={t("teacher.deleteConfirm")}
        confirmLabel={t("portal.delete")}
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </div>
  );
}
