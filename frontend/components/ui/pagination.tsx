"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
  const t = useT();
  if (totalPages <= 1) return null;

  const pages: (number | "ellipsis")[] = [];
  const push = (value: number | "ellipsis") => pages.push(value);
  const windowStart = Math.max(2, page - 1);
  const windowEnd = Math.min(totalPages - 1, page + 1);
  push(1);
  if (windowStart > 2) push("ellipsis");
  for (let i = windowStart; i <= windowEnd; i += 1) push(i);
  if (windowEnd < totalPages - 1) push("ellipsis");
  if (totalPages > 1) push(totalPages);

  return (
    <nav className={cn("flex flex-wrap items-center justify-center gap-1.5", className)} aria-label={t("common.page")}>
      <Button
        variant="outline"
        size="iconSm"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={t("common.previous")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`gap-${index}`} className="px-1.5 text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? "default" : "ghost"}
            size="iconSm"
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
            className="min-w-8"
          >
            {item}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="iconSm"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={t("common.next")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
