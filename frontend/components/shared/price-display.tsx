"use client";

import { useI18n } from "@/lib/i18n";
import { cn, formatMoney } from "@/lib/utils";

export function PriceDisplay({
  price,
  oldPrice,
  monthly,
  discountPercent,
  free,
  size = "md",
  className,
}: {
  price: string | number;
  oldPrice?: string | number | null;
  monthly?: string | number | null;
  discountPercent?: number;
  free?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useI18n();
  const numericOld = Number(oldPrice || 0);
  const numericPrice = Number(price || 0);
  const hasDiscount = discountPercent ? discountPercent > 0 : numericOld > numericPrice;

  if (free || numericPrice === 0) {
    return (
      <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
        <span className={cn("font-bold text-emerald-500", size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg")}>
          {t("common.free")}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-bold tracking-tight", size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg")}>
        {formatMoney(numericPrice)}
      </span>
      {hasDiscount && numericOld > numericPrice && (
        <span className={cn("text-muted-foreground line-through", size === "sm" ? "text-xs" : "text-sm")}>
          {formatMoney(numericOld)}
        </span>
      )}
      {monthly && Number(monthly) > 0 ? (
        <span className="text-xs text-muted-foreground">
          / {formatMoney(Number(monthly))} {t("common.month")}
        </span>
      ) : null}
    </div>
  );
}
