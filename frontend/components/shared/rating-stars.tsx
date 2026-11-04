import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5" aria-label={`${value} / 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
              star <= rounded
                ? "fill-gold text-gold"
                : star - 0.5 === rounded
                  ? "fill-gold/50 text-gold"
                  : "text-muted-foreground/40",
            )}
          />
        ))}
      </div>
      <span className={cn("font-medium text-foreground", size === "sm" ? "text-xs" : "text-sm")}>
        {value.toFixed(1)}
      </span>
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
