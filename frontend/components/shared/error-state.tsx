"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center", className)}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold">{t("common.error")}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message || t("errors.serverText")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
