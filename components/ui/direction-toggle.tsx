import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DirectionToggleProps = {
  value: "expense" | "income";
  onValueChange: (value: "expense" | "income") => void;
  disabled?: boolean;
  /** "sm" = compact pill toggle for headers, "md" = the bigger 2-up card layout for forms. */
  size?: "sm" | "md";
  /** Only used by size="sm" — inline arrow icons next to the labels. */
  icons?: boolean;
  className?: string;
};

/**
 * Shared expense/income switch, replacing the hand-rolled pill/card toggles
 * previously duplicated across the dashboard booking sheet, quick-add sheet
 * (both steps) and the schedules new-schedule sheet.
 */
export function DirectionToggle({
  value,
  onValueChange,
  disabled,
  size = "sm",
  icons = false,
  className,
}: DirectionToggleProps) {
  if (size === "md") {
    return (
      <div className={cn("grid grid-cols-2 gap-3", className)}>
        <button
          type="button"
          onClick={() => onValueChange("expense")}
          disabled={disabled}
          className={cn(
            "rounded-lg border px-4 py-3 text-left transition",
            value === "expense"
              ? "border-expense/30 bg-expense-muted text-expense"
              : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground",
          )}
        >
          <p className="font-medium">Ausgabe</p>
          <p className="mt-1 text-xs">Abos, Miete, Fixkosten</p>
        </button>
        <button
          type="button"
          onClick={() => onValueChange("income")}
          disabled={disabled}
          className={cn(
            "rounded-lg border px-4 py-3 text-left transition",
            value === "income"
              ? "border-income/30 bg-income-muted text-income"
              : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground",
          )}
        >
          <p className="font-medium">Einnahme</p>
          <p className="mt-1 text-xs">Gehalt, Gutschriften</p>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 rounded-full border border-border/70 bg-muted/40 p-1",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onValueChange("expense")}
        disabled={disabled}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-medium transition",
          value === "expense"
            ? "bg-expense text-expense-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {icons ? <ArrowDownLeft className="mr-1 inline h-3 w-3" /> : null}
        Ausgabe
      </button>
      <button
        type="button"
        onClick={() => onValueChange("income")}
        disabled={disabled}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-medium transition",
          value === "income"
            ? "bg-income text-income-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {icons ? <ArrowUpRight className="mr-1 inline h-3 w-3" /> : null}
        Einnahme
      </button>
    </div>
  );
}
