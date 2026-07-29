import { cn } from "@/lib/utils";

/**
 * The tinted tile that opens every list row. It carries the entity's own color
 * (a tracker's, a category's) at low opacity so a long list stays scannable by
 * color without turning loud.
 */

const sizeStyles = {
  sm: "h-8 w-8 rounded-md text-xs [&_svg]:size-3.5",
  md: "h-10 w-10 rounded-lg text-sm [&_svg]:size-4",
} as const;

/** Only tint from values we know are safe to interpolate into a color-mix(). */
const SAFE_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

type EntityIconProps = {
  icon?: React.ElementType;
  color?: string | null;
  /** Supplies the initial when no icon is given. */
  label?: string;
  size?: keyof typeof sizeStyles;
  className?: string;
};

export function EntityIcon({
  icon: Icon,
  color,
  label,
  size = "md",
  className,
}: EntityIconProps) {
  const tint = color && SAFE_COLOR.test(color) ? color : null;

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold",
        sizeStyles[size],
        tint ? null : "bg-muted text-muted-foreground",
        className,
      )}
      style={
        tint
          ? {
              backgroundColor: `color-mix(in oklab, ${tint} 16%, transparent)`,
              color: tint,
            }
          : undefined
      }
    >
      {Icon ? <Icon /> : (label?.trim().charAt(0).toUpperCase() ?? "?")}
    </span>
  );
}
