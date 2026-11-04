"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, ExternalLink, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { apiRequest, mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useMyCourses } from "@/lib/queries";
import { cn, formatMoney, formatNumber } from "@/lib/utils";
import type { Course } from "@/lib/types";
import { PageHeading } from "@/features/dashboard/shared";
import { ConfirmDialog, LoadingTable, StatusPill, TableEmpty } from "./shared";

export function CourseListPage({ role }: { role: "teacher" | "admin" }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const courses = useMyCourses();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [toDelete, setToDelete] = useState<Course | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["teacher-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
  };

  const toggle = useMutation({
    mutationFn: (course: Course) =>
      apiRequest<Course>(`/api/courses/${course.slug}/${course.status === "published" ? "unpublish" : "publish"}/`, {
        method: "POST",
      }),
    onSuccess: (_data, course) => {
      toast.success(course.status === "published" ? t("portal.unpublish") : t("portal.publish"));
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const remove = useMutation({
    mutationFn: (course: Course) => apiRequest(`/api/courses/${course.slug}/`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("teacher.courseDeleted"));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const filtered = useMemo(() => {
    const items = courses.data?.results ?? [];
    const query = search.trim().toLowerCase();
    return items.filter((course) => {
      if (status !== "all" && course.status !== status) return false;
      if (!query) return true;
      return (
        course.title.toLowerCase().includes(query) ||
        course.teacher?.full_name?.toLowerCase().includes(query) ||
        course.category?.name_uz?.toLowerCase().includes(query) ||
        course.category?.name_ru?.toLowerCase().includes(query)
      );
    });
  }, [courses.data, search, status]);

  if (courses.isError) {
    return (
      <ErrorState
        message={courses.error instanceof Error ? courses.error.message : undefined}
        onRetry={() => courses.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow={role === "teacher" ? t("teacher.title") : t("admin.title")}
        title={role === "teacher" ? t("teacher.myCourses") : t("admin.courses")}
        subtitle={role === "teacher" ? t("teacher.noCoursesHint") : t("admin.subtitle")}
        actions={
          <Button asChild variant="gradient">
            <Link href={`/${role}/courses/new`}>
              <Plus className="h-4 w-4" />
              {t("teacher.createCourse")}
            </Link>
          </Button>
        }
      />

      <div className="surface mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("portal.searchCourses")}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("portal.allStatuses")}</SelectItem>
            <SelectItem value="published">{t("portal.published")}</SelectItem>
            <SelectItem value="draft">{t("portal.draft")}</SelectItem>
            <SelectItem value="archived">{t("portal.archived")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t("portal.course")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.status")}</th>
                <th className="px-3 py-3 font-semibold">{t("teacher.lessons")}</th>
                <th className="px-3 py-3 font-semibold">{t("teacher.studentsCount")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.price")}</th>
                <th className="px-3 py-3 text-right font-semibold">{t("portal.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {courses.isLoading ? (
                <LoadingTable rows={6} columns={6} />
              ) : filtered.length ? (
                filtered.map((course) => {
                  const thumbnail = mediaUrl(course.thumbnail);
                  return (
                    <tr key={course.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex min-w-[260px] items-center gap-3">
                          <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary">
                            {thumbnail ? (
                              <Image src={thumbnail} alt="" fill sizes="64px" className="object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <BookOpen className="h-5 w-5" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/${role}/courses/${course.slug}`}
                              className="line-clamp-1 font-medium hover:text-primary"
                            >
                              {course.title}
                            </Link>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {lang === "ru" ? course.category?.name_ru : course.category?.name_uz}
                              {role === "admin" ? ` · ${course.teacher?.full_name}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={course.status} />
                      </td>
                      <td className="px-3 py-3">{formatNumber(course.lessons_count)}</td>
                      <td className="px-3 py-3">{formatNumber(course.students_count)}</td>
                      <td className="px-3 py-3">
                        {course.is_free ? (
                          <span className="text-emerald-600 dark:text-emerald-400">{t("common.free")}</span>
                        ) : (
                          <span>{formatMoney(course.effective_monthly_price)}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => toggle.mutate(course)}
                            disabled={toggle.isPending}
                            title={course.status === "published" ? t("portal.unpublish") : t("portal.publish")}
                          >
                            <Eye className={cn("h-4 w-4", course.status === "published" ? "text-emerald-500" : "")} />
                          </Button>
                          <Button asChild variant="ghost" size="iconSm" title={t("portal.edit")}>
                            <Link href={`/${role}/courses/${course.slug}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          {course.status === "published" ? (
                            <Button asChild variant="ghost" size="iconSm" title={t("common.view")}>
                              <Link href={`/courses/${course.slug}`} target="_blank">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="iconSm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setToDelete(course)}
                            title={t("portal.delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <TableEmpty colSpan={6}>{search || status !== "all" ? t("common.noResults") : t("portal.noCourses")}</TableEmpty>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
