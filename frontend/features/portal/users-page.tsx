"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ShieldCheck, Users } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAdminUsers } from "@/lib/queries";
import { formatDate, formatDateTime, initials } from "@/lib/utils";
import type { AdminUser, Role } from "@/lib/types";
import { PageHeading, StatCard } from "@/features/dashboard/shared";
import { LoadingTable, StatusPill, TableEmpty } from "./shared";

const ROLES: Role[] = ["student", "teacher", "admin"];

export function UsersPage() {
  const { t, lang } = useI18n();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const users = useAdminUsers();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) =>
      apiRequest(`/api/users/${id}/`, { method: "PATCH", body: { role } }),
    onSuccess: () => {
      toast.success(t("portal.saved"));
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const toggleActive = useMutation({
    mutationFn: (target: AdminUser) => apiRequest(`/api/users/${target.id}/toggle_active/`, { method: "POST", body: {} }),
    onSuccess: () => {
      toast.success(t("portal.saved"));
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const items = useMemo(() => users.data?.results ?? [], [users.data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (roleFilter !== "all" && item.role !== roleFilter) return false;
      if (statusFilter === "active" && !item.is_active) return false;
      if (statusFilter === "inactive" && item.is_active) return false;
      if (!query) return true;
      return (
        item.full_name?.toLowerCase().includes(query) ||
        item.email?.toLowerCase().includes(query) ||
        item.phone?.toLowerCase().includes(query)
      );
    });
  }, [items, roleFilter, search, statusFilter]);

  if (users.isError) {
    return (
      <ErrorState
        message={users.error instanceof Error ? users.error.message : undefined}
        onRetry={() => users.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeading eyebrow={t("admin.title")} title={t("admin.userManagement")} subtitle={t("admin.subtitle")} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label={t("portal.users")} value={items.length} />
        <StatCard
          icon={Users}
          label={t("roles.student")}
          value={items.filter((item) => item.role === "student").length}
          tone="violet"
        />
        <StatCard
          icon={Users}
          label={t("roles.teacher")}
          value={items.filter((item) => item.role === "teacher").length}
          tone="gold"
        />
        <StatCard
          icon={ShieldCheck}
          label={t("portal.activeOnly")}
          value={items.filter((item) => item.is_active).length}
          tone="emerald"
        />
      </div>

      <div className="surface mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_160px_170px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("portal.searchUsers")}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("portal.allRoles")}</SelectItem>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {t(`roles.${role}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("portal.allStatuses")}</SelectItem>
            <SelectItem value="active">{t("portal.activeOnly")}</SelectItem>
            <SelectItem value="inactive">{t("portal.inactiveOnly")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t("portal.name")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.role")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.enrollments")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.joined")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.lastLogin")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.status")}</th>
                <th className="px-3 py-3 text-right font-semibold">{t("portal.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.isLoading ? (
                <LoadingTable rows={7} columns={7} />
              ) : filtered.length ? (
                filtered.map((item) => {
                  const isSelf = currentUser?.id === item.id;
                  return (
                    <tr key={item.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex min-w-[200px] items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                            {initials(item.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {item.full_name}
                              {isSelf ? <span className="ml-1 text-[10px] text-primary">({t("common.you")})</span> : null}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">{item.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          value={item.role}
                          onValueChange={(value) => updateRole.mutate({ id: item.id, role: value as Role })}
                          disabled={isSelf || updateRole.isPending}
                        >
                          <SelectTrigger className="h-8 w-[132px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {t(`roles.${role}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-3">{item.enrollments_count}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(item.created_at, lang)}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {formatDateTime(item.last_login, lang)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={item.is_active ? "active" : "inactive"} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={item.is_active}
                            onCheckedChange={() => toggleActive.mutate(item)}
                            disabled={isSelf || toggleActive.isPending}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <TableEmpty colSpan={7}>{search ? t("common.noResults") : t("portal.noUsers")}</TableEmpty>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
