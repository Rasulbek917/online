"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/error-state";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAdminSettings } from "@/lib/portal";
import { PageHeading, SectionPanel } from "@/features/dashboard/shared";
import { FilterField } from "./shared";

const EMPTY = {
  site_name: "",
  support_email: "",
  support_phone: "",
  telegram_url: "",
  instagram_url: "",
  youtube_url: "",
  default_language: "uz" as "uz" | "ru",
  grace_period_days: "3",
  subscription_period_days: "30",
  quiz_passing_score: "7",
  certificate_enabled: true,
  maintenance_mode: false,
  click_enabled: true,
  payme_enabled: true,
  uzum_enabled: true,
  announcement: "",
};

export function SettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const settings = useAdminSettings();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!settings.data) return;
    const data = settings.data;
    setForm({
      site_name: data.site_name || "",
      support_email: data.support_email || "",
      support_phone: data.support_phone || "",
      telegram_url: data.telegram_url || "",
      instagram_url: data.instagram_url || "",
      youtube_url: data.youtube_url || "",
      default_language: data.default_language === "ru" ? "ru" : "uz",
      grace_period_days: String(data.grace_period_days ?? 3),
      subscription_period_days: String(data.subscription_period_days ?? 30),
      quiz_passing_score: String(data.quiz_passing_score ?? 7),
      certificate_enabled: Boolean(data.certificate_enabled),
      maintenance_mode: Boolean(data.maintenance_mode),
      click_enabled: Boolean(data.click_enabled),
      payme_enabled: Boolean(data.payme_enabled),
      uzum_enabled: Boolean(data.uzum_enabled),
      announcement: data.announcement || "",
    });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest("/api/settings/", {
        method: "PATCH",
        body: {
          ...form,
          grace_period_days: Number(form.grace_period_days),
          subscription_period_days: Number(form.subscription_period_days),
          quiz_passing_score: Number(form.quiz_passing_score),
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.settingsSaved"));
      queryClient.invalidateQueries({ queryKey: ["portal", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-settings"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.site_name || !form.support_email) {
      toast.error(t("portal.requiredFields"));
      return;
    }
    save.mutate();
  };

  if (settings.isError) {
    return (
      <ErrorState
        message={settings.error instanceof Error ? settings.error.message : undefined}
        onRetry={() => settings.refetch()}
      />
    );
  }

  const toggleKeys: { key: keyof typeof EMPTY; label: string }[] = [
    { key: "certificate_enabled", label: t("admin.certificateEnabled") },
    { key: "maintenance_mode", label: t("admin.maintenanceMode") },
    { key: "click_enabled", label: t("admin.clickEnabled") },
    { key: "payme_enabled", label: t("admin.paymeEnabled") },
    { key: "uzum_enabled", label: t("admin.uzumEnabled") },
  ];

  return (
    <div>
      <PageHeading eyebrow={t("admin.title")} title={t("admin.settingsTitle")} subtitle={t("admin.subtitle")} />

      <form className="space-y-4" onSubmit={submit}>
        <SectionPanel title={t("admin.settings")} icon={Settings}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FilterField label={t("admin.siteName")}>
              <Input value={form.site_name} onChange={(event) => setForm({ ...form, site_name: event.target.value })} />
            </FilterField>
            <FilterField label={t("admin.supportEmail")}>
              <Input
                type="email"
                value={form.support_email}
                onChange={(event) => setForm({ ...form, support_email: event.target.value })}
              />
            </FilterField>
            <FilterField label={t("admin.supportPhone")}>
              <Input
                value={form.support_phone}
                onChange={(event) => setForm({ ...form, support_phone: event.target.value })}
              />
            </FilterField>
            <FilterField label={t("admin.defaultLanguage")}>
              <Select
                value={form.default_language}
                onValueChange={(value) => setForm({ ...form, default_language: value as "uz" | "ru" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uz">O'zbekcha</SelectItem>
                  <SelectItem value="ru">Русский</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label={t("admin.telegramUrl")}>
              <Input
                value={form.telegram_url}
                onChange={(event) => setForm({ ...form, telegram_url: event.target.value })}
              />
            </FilterField>
            <FilterField label={t("admin.instagramUrl")}>
              <Input
                value={form.instagram_url}
                onChange={(event) => setForm({ ...form, instagram_url: event.target.value })}
              />
            </FilterField>
            <FilterField label={t("admin.youtubeUrl")}>
              <Input
                value={form.youtube_url}
                onChange={(event) => setForm({ ...form, youtube_url: event.target.value })}
              />
            </FilterField>
            <FilterField label={t("admin.announcement")}>
              <Textarea
                rows={2}
                value={form.announcement}
                onChange={(event) => setForm({ ...form, announcement: event.target.value })}
              />
            </FilterField>
          </div>
        </SectionPanel>

        <SectionPanel title={t("teacher.pricing")} icon={Settings}>
          <div className="grid gap-3 sm:grid-cols-3">
            <FilterField label={t("admin.gracePeriod")}>
              <Input
                type="number"
                min={0}
                value={form.grace_period_days}
                onChange={(event) => setForm({ ...form, grace_period_days: event.target.value })}
              />
            </FilterField>
            <FilterField label={t("admin.subscriptionPeriod")}>
              <Input
                type="number"
                min={1}
                value={form.subscription_period_days}
                onChange={(event) => setForm({ ...form, subscription_period_days: event.target.value })}
              />
            </FilterField>
            <FilterField label={t("admin.quizPassingScore")}>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.quiz_passing_score}
                onChange={(event) => setForm({ ...form, quiz_passing_score: event.target.value })}
              />
            </FilterField>
          </div>
        </SectionPanel>

        <SectionPanel title={t("portal.settingsPayment")} icon={Settings}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {toggleKeys.map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5 text-sm"
              >
                <span>{item.label}</span>
                <Switch
                  checked={Boolean(form[item.key])}
                  onCheckedChange={(checked) => setForm({ ...form, [item.key]: checked })}
                />
              </label>
            ))}
          </div>
        </SectionPanel>

        <Button type="submit" variant="gradient" disabled={save.isPending || settings.isLoading}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {save.isPending ? t("portal.saving") : t("admin.saveSettings")}
        </Button>
      </form>
    </div>
  );
}
