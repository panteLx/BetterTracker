import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: "income" | "expense" | "warning" | "neutral" | "primary";
  secondaryValue?: string;
  helperText?: string;
  className?: string;
};

const toneConfig = {
  income: {
    text: "text-income",
    icon: "text-income",
    iconBg: "bg-income-muted",
    surface: "bg-gradient-to-br from-income-muted/60 via-income-muted/20 to-transparent",
  },
  expense: {
    text: "text-expense",
    icon: "text-expense",
    iconBg: "bg-expense-muted",
    surface: "bg-gradient-to-br from-expense-muted/60 via-expense-muted/20 to-transparent",
  },
  warning: {
    text: "text-warning",
    icon: "text-warning",
    iconBg: "bg-warning-muted",
    surface: "bg-gradient-to-br from-warning-muted/60 via-warning-muted/20 to-transparent",
  },
  primary: {
    text: "text-primary",
    icon: "text-primary",
    iconBg: "bg-primary/10",
    surface: "bg-gradient-to-br from-primary/8 via-primary/4 to-transparent",
  },
  neutral: {
    text: "text-foreground",
    icon: "text-muted-foreground",
    iconBg: "bg-muted",
    surface: "bg-gradient-to-br from-muted/60 via-muted/20 to-transparent",
  },
};

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  secondaryValue,
  helperText,
  className,
}: StatTileProps) {
  const config = toneConfig[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 p-3",
        config.surface,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "font-mono text-xl font-semibold tracking-tight tabular-nums",
              config.text,
            )}
          >
            {value}
          </p>
          {secondaryValue ? (
            <p className="text-xs font-medium text-muted-foreground tabular-nums">
              {secondaryValue}
            </p>
          ) : null}
          {helperText ? (
            <p className="text-xs text-muted-foreground">{helperText}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "shrink-0 rounded-lg border border-border/50 p-2",
            config.iconBg,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", config.icon)} />
        </div>
      </div>
    </div>
  );
}

export function StatTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card p-3 animate-pulse",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2 flex-1">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="h-6 w-24 rounded bg-muted" />
        </div>
        <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
      </div>
    </div>
  );
}
