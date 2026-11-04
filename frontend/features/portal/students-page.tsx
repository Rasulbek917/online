"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/shared/error-state";
import { useI18n } from "@/lib/i18n";
import { useStudents } from "@/lib/queries";
import { formatDate, initials } from "@/lib/utils";
import { PageHeading, StatCard } from "@/features/dashboard/shared";
import { LoadingTable, StatusPill, TableEmpty } from "./shared";

export function StudentsPage() {
  const { t, lang } = useI18n();
  const students = useStudents();
  const [search, setSearch] = useState("");

  const items = useMemo(() => students.data?.results ?? [], [students.data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (student) =>
        student.full_name?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query) ||
        student.phone?.toLowerCase().includes(query),
    );
  }, [items, search]);

  if (students.isError) {
    return (
      <ErrorState
        message={students.error instanceof Error ? students.error.message : undefined}
        onRetry={() => students.refetch()}
      />
    );
  }

  const activeCount = items.filter((student) => student.is_active).length;
  const totalEnrollments = items.reduce((sum, student) => sum + (student.enrollments_count || 0), 0);

  return (
    <div>
      <PageHeading eyebrow={t("teacher.title")} title={t("teacher.students")} subtitle={t("teacher.subtitle")} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label={t("teacher.students")} value={items.length} />
        <StatCard icon={Users} label={t("portal.activeOnly")} value={activeCount} tone="emerald" />
        <StatCard icon={Users} label={t("portal.totalEnrollments")} value={totalEnrollments} tone="violet" />
      </div>

      <div className="surface mb-4 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("portal.searchUsers")}
            className="pl-9"
          />
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t("portal.student")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.email")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.phone")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.enrollments")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.joined")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.status")}</th>
              </tr>
            </thead>
            <tbody>
              {students.isLoading ? (
                <LoadingTable rows={6} columns={6} />
              ) : filtered.length ? (
                filtered.map((student) => (
                  <tr key={student.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex min-w-[180px] items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                          {initials(student.full_name)}
                        </span>
                        <div>
                          <p className="font-medium">{student.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {student.is_email_verified ? t("admin.verified") : t("admin.unverified")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{student.email}</td>
                    <td className="px-3 py-3 text-muted-foreground">{student.phone || "—"}</td>
                    <td className="px-3 py-3">{student.enrollments_count}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(student.created_at, lang)}</td>
                    <td className="px-3 py-3">
                      <StatusPill status={student.is_active ? "active" : "inactive"} />
                    </td>
                  </tr>
                ))
              ) : (
                <TableEmpty colSpan={6}>{search ? t("common.noResults") : t("teacher.noStudents")}</TableEmpty>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
