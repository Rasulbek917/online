"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function Logo({
  href = "/",
  className,
  compact = false,
  onClick,
}: {
  href?: string;
  className?: string;
  compact?: boolean;
  onClick?: () => void;
}) {
  const t = useT();
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label={t("brand")}
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-brand-2 text-white shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
        <GraduationCap className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-tight">IT PARK</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Academy</span>
        </span>
      )}
    </Link>
  );
}
