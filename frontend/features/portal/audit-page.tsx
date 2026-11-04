"use client";

import { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/shared/error-state";
import { useI18n } from "@/lib/i18n";
import { useAuditLogs } from "@/lib/portal";
import { formatDateTime } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";
import { PageHeading } from "@/features/dashboard/shared";
import { LoadingTable, TableEmpty } from "./shared";

export function AuditPage() {
  const { t, lang } = useI18n();
  const logs = useAuditLogs();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const items = useMemo(() => logs.data?.results ?? [], [logs.data]);
  const actions = useMemo(() => Array.from(new Set(items.map((log) => log.action))).sort(), [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((log) => {
      if (action !== "all" && log.action !== action) return false;
      if (!query) return true;
      return (
        log.action.toLowerCase().includes(query) ||
        log.model_name.toLowerCase().includes(query) ||
        log.object_id.toLowerCase().includes(query) ||
        (log.user_email || "").toLowerCase().includes(query)
      );
    });
  }, [action, items, search]);

  if (logs.isError) {
    return (
      <ErrorState
        message={logs.error instanceof Error ? logs.error.message : undefined}
        onRetry={() => logs.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeading eyebrow={t("admin.title")} title={t("admin.auditLogs")} subtitle={t("admin.subtitle")} />

      <div className="surface mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("portal.searchAudit")}
            className="pl-9"
          />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("portal.allStatuses")}</SelectItem>
            {actions.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
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
                <th className="px-4 py-3 font-semibold">{t("admin.when")}</th>
                <th className="px-3 py-3 font-semibold">{t("admin.user")}</th>
                <th className="px-3 py-3 font-semibold">{t("admin.action")}</th>
                <th className="px-3 py-3 font-semibold">{t("admin.model")}</th>
                <th className="px-3 py-3 font-semibold">{t("admin.objectId")}</th>
                <th className="px-3 py-3 font-semibold">{t("admin.ip")}</th>
                <th className="px-3 py-3 text-right font-semibold">{t("portal.details")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.isLoading ? (
                <LoadingTable rows={7} columns={7} />
              ) : filtered.length ? (
                filtered.map((log) => (
                  <tr key={log.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(log.created_at, lang)}</td>
                    <td className="px-3 py-3">{log.user_email || "—"}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px]">{log.action}</span>
                    </td>
                    <td className="px-3 py-3 text-xs">{log.model_name}</td>
                    <td className="px-3 py-3 font-mono text-xs">{log.object_id}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{log.ip_address || "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(log)}>
                        <ScrollText className="h-4 w-4" />
                        {t("portal.details")}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <TableEmpty colSpan={7}>{search || action !== "all" ? t("common.noResults") : t("admin.noAudit")}</TableEmpty>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.auditLogs")}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t("admin.when")}: </span>
                {formatDateTime(selected.created_at, lang)}
              </p>
              <p>
                <span className="text-muted-foreground">{t("admin.user")}: </span>
                {selected.user_email || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">{t("admin.action")}: </span>
                {selected.action}
              </p>
              <p>
                <span className="text-muted-foreground">{t("admin.model")}: </span>
                {selected.model_name} #{selected.object_id}
              </p>
              <pre className="max-h-64 overflow-auto rounded-xl bg-secondary/60 p-3 text-[11px]">
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
