import { Children } from "react";
import { cn } from "@/lib/utils";

/**
 * The shared row for every list of records in the app — bookings, scheduled
 * items, public tracker entries. One row layout for phone and desktop alike,
 * so there is a single thing to design and a single thing to keep correct.
 *
 * Layout: tinted icon tile, then the identifying text, then the amount hard
 * against the right edge, with actions that surface when you reach for the row
 * (see `.row-actions` in globals.css for the touch behaviour).
 */
type ListRowProps = {
  /** Usually an <EntityIcon />. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Chips or badges above the title. */
  meta?: React.ReactNode;
  /** Usually an <Amount />. */
  trailing?: React.ReactNode;
  /** Revealed on hover and on keyboard focus. */
  actions?: React.ReactNode;
  /** Expanded content below the row, e.g. an inline edit form. */
  children?: React.ReactNode;
  className?: string;
};

export function ListRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  actions,
  children,
  className,
}: ListRowProps) {
  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-card transition-colors duration-(--motion-duration-fast) hover:border-border-strong",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {leading}

        <div className="min-w-0 flex-1">
          {meta ? (
            <div className="mb-1 flex flex-wrap items-center gap-1.5">{meta}</div>
          ) : null}
          <p className="truncate text-sm font-medium">{title}</p>
          {subtitle ? (
            <p className="truncate font-subtext text-xs text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          {actions ? (
            <div className="row-actions flex items-center gap-0.5">{actions}</div>
          ) : null}
        </div>
      </div>

      {/* Children arrive as an array of conditionals, and an array of nulls is
          still truthy — count the real ones before drawing the frame. */}
      {Children.toArray(children).length > 0 ? (
        <div className="border-t border-border px-3 py-3">{children}</div>
      ) : null}
    </div>
  );
}

/**
 * A day's worth of rows under a date heading, with the day's net on the right.
 * The running total is the reason to group by day at all — it answers "what did
 * this day cost me" without any arithmetic.
 */
type DayGroupProps = {
  label: string;
  total?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function DayGroup({ label, total, children, className }: DayGroupProps) {
  return (
    <section className={cn("space-y-1.5", className)}>
      <header className="flex items-baseline justify-between gap-3 px-1">
        <h3 className="type-label">{label}</h3>
        {total ? <span className="shrink-0">{total}</span> : null}
      </header>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
