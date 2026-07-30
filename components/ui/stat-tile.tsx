import { cn } from "@/lib/utils";
import { MicroLabel } from "@/components/ui/micro-label";
import { StatTileTrend } from "@/components/ui/stat-tile-trend";

/**
 * A single number with its name above it. Deliberately plain: no gradient, no
 * border flourish, nothing competing with the figure itself.
 *
 * `tone="inverse"` fills the tile with the accent and is the one loud element
 * a screen gets. Use it exactly once per screen, on the number that matters
 * most — a second inverse tile costs the first one its job.
 */

const toneStyles = {
  default: { root: "border-border bg-card", value: "text-foreground" },
  income: { root: "border-border bg-card", value: "text-income" },
  expense: { root: "border-border bg-card", value: "text-expense" },
  inverse: {
    root: "border-transparent bg-primary",
    value: "text-primary-foreground",
  },
} as const;

type StatTileProps = {
  label: string;
  /** A string, or an <Amount /> that brings its own size. */
  value: React.ReactNode;
  icon?: React.ElementType;
  tone?: keyof typeof toneStyles;
  /** One line under the number — a forecast, a comparison. */
  sublabel?: React.ReactNode;
  helperText?: string;
  /** A quiet trailing sparkline — recent history, not another headline number. */
  trend?: number[];
  trendColor?: string;
  className?: string;
};

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
  sublabel,
  helperText,
  trend,
  trendColor,
  className,
}: StatTileProps) {
  const styles = toneStyles[tone];
  const inverse = tone === "inverse";
  const hasTrend = trend && trend.length > 1;
  const sparklineColor =
    trendColor ?? (inverse ? "var(--primary-foreground)" : "var(--foreground)");

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-4 shadow-card sm:p-5",
        styles.root,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <MicroLabel
          className={cn(
            "min-w-0 truncate",
            inverse ? "text-primary-foreground/60" : undefined,
          )}
        >
          {label}
        </MicroLabel>
        {Icon ? (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              inverse ? "text-primary-foreground/50" : "text-muted-foreground",
            )}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          styles.value,
        )}
      >
        {value}
      </div>

      {sublabel ? (
        <div
          className={cn(
            "mt-1.5 font-subtext text-xs",
            inverse ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {sublabel}
        </div>
      ) : null}

      {helperText ? (
        <p
          className={cn(
            "mt-0.5 font-subtext text-xs",
            inverse ? "text-primary-foreground/55" : "text-muted-foreground",
          )}
        >
          {helperText}
        </p>
      ) : null}

      {hasTrend ? (
        <StatTileTrend trend={trend} color={sparklineColor} inverse={inverse} />
      ) : null}
    </div>
  );
}

export function StatTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl border border-border bg-card p-4 shadow-card sm:p-5",
        className,
      )}
    >
      <div className="h-3 w-20 rounded bg-muted" />
      <div className="mt-3 h-7 w-28 rounded bg-muted" />
    </div>
  );
}
