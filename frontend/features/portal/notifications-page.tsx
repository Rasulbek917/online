"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Loader2, Send } from "lucide-react";
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
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useMyCourses } from "@/lib/queries";
import { useBroadcasts } from "@/lib/portal";
import { formatDateTime } from "@/lib/utils";
import { PageHeading, SectionPanel } from "@/features/dashboard/shared";
import { FilterField } from "./shared";

const TYPES = [
  "system",
  "new_lesson",
  "new_course",
  "discount",
  "quiz_result",
  "certificate_ready",
  "subscription_expiring",
] as const;

export function NotificationsPage({ role }: { role: "teacher" | "admin" }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const courses = useMyCourses(true);
  const recent = useBroadcasts();
  const [form, setForm] = useState({
    type: "system",
    audience: role === "teacher" ? "course" : "students",
    course_slug: "",
    title_uz: "",
    title_ru: "",
    message_uz: "",
    message_ru: "",
    telegram: false,
    push: true,
  });

  const send = useMutation({
    mutationFn: () =>
      apiRequest<{ sent: number }>("/api/notifications/broadcast/", {
        method: "POST",
        body: {
          ...form,
          course_slug: form.audience === "course" ? form.course_slug : "",
        },
      }),
    onSuccess: (data) => {
      toast.success(t("portal.broadcastSent", { n: data.sent }));
      setForm((prev) => ({ ...prev, title_uz: "", title_ru: "", message_uz: "", message_ru: "" }));
      queryClient.invalidateQueries({ queryKey: ["portal", "broadcasts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title_uz || !form.title_ru || !form.message_uz || !form.message_ru) {
      toast.error(t("portal.requiredFields"));
      return;
    }
    if (form.audience === "course" && !form.course_slug) {
      toast.error(t("portal.chooseCourse"));
      return;
    }
    send.mutate();
  };

  return (
    <div>
      <PageHeading
        eyebrow={role === "teacher" ? t("teacher.title") : t("admin.title")}
        title={t("teacher.broadcastTitle")}
        subtitle={t("teacher.broadcastHint")}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <form className="surface space-y-4 p-4 sm:p-5" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FilterField label={t("portal.type")}>
              <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`portal.notificationTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label={t("teacher.audience")}>
              <Select
                value={form.audience}
                onValueChange={(value) => setForm((prev) => ({ ...prev, audience: value }))}
                disabled={role === "teacher"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {role === "admin" ? <SelectItem value="students">{t("teacher.allStudents")}</SelectItem> : null}
                  {role === "admin" ? <SelectItem value="all">{t("portal.allUsers")}</SelectItem> : null}
                  <SelectItem value="course">{t("teacher.courseStudentsOnly")}</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </div>

          {form.audience === "course" ? (
            <FilterField label={t("portal.course")}>
              <Select
                value={form.course_slug}
                onValueChange={(value) => setForm((prev) => ({ ...prev, course_slug: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("portal.chooseCourse")} />
                </SelectTrigger>
                <SelectContent>
                  {(courses.data?.results ?? []).map((course) => (
                    <SelectItem key={course.slug} value={course.slug}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <FilterField label={t("portal.titleUz")}>
              <Input
                value={form.title_uz}
                onChange={(event) => setForm((prev) => ({ ...prev, title_uz: event.target.value }))}
              />
            </FilterField>
            <FilterField label={t("portal.titleRu")}>
              <Input
                value={form.title_ru}
                onChange={(event) => setForm((prev) => ({ ...prev, title_ru: event.target.value }))}
              />
            </FilterField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FilterField label={t("portal.messageUz")}>
              <Textarea
                rows={5}
                value={form.message_uz}
                onChange={(event) => setForm((prev) => ({ ...prev, message_uz: event.target.value }))}
              />
            </FilterField>
            <FilterField label={t("portal.messageRu")}>
              <Textarea
                rows={5}
                value={form.message_ru}
                onChange={(event) => setForm((prev) => ({ ...prev, message_ru: event.target.value }))}
              />
            </FilterField>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5 text-sm">
              <span>{t("portal.push")}</span>
              <Switch
                checked={form.push}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, push: checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5 text-sm">
              <span>{t("portal.telegram")}</span>
              <Switch
                checked={form.telegram}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, telegram: checked }))}
              />
            </label>
          </div>

          {role === "teacher" ? (
            <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {t("portal.audienceHint")}
            </p>
          ) : null}

          <Button type="submit" variant="gradient" disabled={send.isPending}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {send.isPending ? t("portal.sending") : t("portal.sendNotification")}
          </Button>
        </form>

        <SectionPanel title={t("portal.broadcastHistory")} icon={Bell}>
          {recent.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : recent.data?.results?.length ? (
            <ul className="divide-y divide-border/60">
              {recent.data.results.map((broadcast) => (
                <li key={broadcast.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium">
                    {lang === "ru" ? broadcast.title_ru : broadcast.title_uz}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {lang === "ru" ? broadcast.message_ru : broadcast.message_uz}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("portal.recipients", { n: broadcast.recipients_count })} ·{" "}
                    {formatDateTime(broadcast.created_at, lang)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("portal.noBroadcasts")}</p>
          )}
        </SectionPanel>
      </div>
    </div>
  );
}
