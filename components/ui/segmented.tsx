"use client";

import { cn } from "@/lib/utils";

/**
 * Pill segment control. Two shapes, one recipe:
 *
 * - `track` — chips riding on a recessed rail, the active one lifted out in
 *   card white. This is navigation: the options are peers and one is "where
 *   you are".
 * - `solid` — free-standing pills on the page, the active one filled with the
 *   accent. This is selection: you are picking one thing out of a set.
 *
 * The class builders are exported because the header navigation needs the same
 * look on `<Link>` elements rather than buttons.
 */

export type SegmentedVariant = "track" | "solid";
export type SegmentedSize = "sm" | "md";

export function segmentedTrackClass(
  variant: SegmentedVariant,
  className?: string,
) {
  return cn(
    variant === "track"
      ? "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-pill border border-border bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      : "flex flex-wrap items-center gap-1.5",
    className,
  );
}

export function segmentedItemClass(
  {
    variant,
    size,
    active,
  }: { variant: SegmentedVariant; size: SegmentedSize; active: boolean },
  className?: string,
) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill font-medium whitespace-nowrap",
    "transition-colors duration-(--motion-duration-fast) outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
    variant === "track"
      ? active
        ? "bg-card text-foreground shadow-xs"
        : "text-muted-foreground hover:text-foreground"
      : active
        ? "border border-transparent bg-primary text-primary-foreground shadow-sm"
        : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
    className,
  );
}

export type SegmentedItem<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ElementType;
  /** Small color dot before the label — used to carry a tracker's color. */
  dot?: string | null;
  /** Escape hatch for per-item DOM props, e.g. drag-and-drop handlers. */
  buttonProps?: React.ComponentProps<"button">;
};

type SegmentedProps<T extends string> = {
  items: SegmentedItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  variant?: SegmentedVariant;
  size?: SegmentedSize;
  label: string;
  className?: string;
  itemClassName?: string;
};

export function Segmented<T extends string>({
  items,
  value,
  onValueChange,
  variant = "track",
  size = "md",
  label,
  className,
  itemClassName,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={segmentedTrackClass(variant, className)}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(item.value)}
            {...item.buttonProps}
            className={segmentedItemClass(
              { variant, size, active },
              cn(itemClassName, item.buttonProps?.className),
            )}
          >
            {item.dot ? (
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.dot }}
              />
            ) : null}
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
