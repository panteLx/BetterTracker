"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * A currency amount, set the way the rest of the design expects to see one:
 * the integer part large and heavy, the currency symbol and the decimals
 * small and stepped back. That contrast is what makes a number read as a
 * headline instead of as body copy.
 *
 * The split is driven by `Intl.NumberFormat.formatToParts()` rather than by
 * slicing the formatted string, so it holds up in every locale — de-DE puts
 * the symbol last ("1.234,56 €"), en-US puts it first ("$1,234.56"), and both
 * come out with the same parts tagged as small.
 */

/** Part types that stay at full size. Everything else is stepped back. */
const FULL_SIZE_PARTS = new Set<Intl.NumberFormatPartTypes>([
  "minusSign",
  "plusSign",
  "integer",
  "group",
]);

const sizeStyles = {
  xs: { root: "text-xs font-semibold", small: "text-[0.8em]" },
  sm: { root: "text-sm font-semibold", small: "text-[0.78em]" },
  md: { root: "text-base font-semibold", small: "text-[0.75em]" },
  lg: { root: "text-2xl font-semibold", small: "text-[0.6em]" },
  xl: { root: "text-4xl font-semibold leading-[1.05]", small: "text-[0.45em]" },
} as const;

type AmountProps = {
  cents: number;
  currency?: string;
  locale?: string;
  /**
   * Forces both sign and color: an expense always renders negative and red,
   * an income positive and green. Omit it to render the value's own sign
   * without a tone.
   */
  direction?: "expense" | "income" | null;
  /** Render an explicit "+" in front of incomes. */
  signed?: boolean;
  size?: keyof typeof sizeStyles;
  /** Set to "none" inside inverted cards, where the tone colors would clash. */
  tone?: "auto" | "none";
  className?: string;
};

export function Amount({
  cents,
  currency = "EUR",
  locale,
  direction = null,
  signed = false,
  size = "md",
  tone = "auto",
  className,
}: AmountProps) {
  const activeLocale = useLocale();
  const resolvedLocale = locale ?? activeLocale;
  const magnitude = Math.abs(cents) / 100;
  const value =
    direction === "expense"
      ? -magnitude
      : direction === "income"
        ? magnitude
        : cents / 100;

  const parts = new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency,
    signDisplay: signed && direction === "income" ? "always" : "auto",
  }).formatToParts(value);

  const styles = sizeStyles[size];
  const toneClass =
    tone === "none"
      ? undefined
      : direction === "expense"
        ? "text-expense"
        : direction === "income"
          ? "text-income"
          : undefined;

  return (
    <span
      data-slot="amount"
      className={cn(
        "inline-flex items-baseline whitespace-nowrap tracking-tight",
        styles.root,
        toneClass,
        className,
      )}
    >
      {parts.map((part, index) => (
        <span
          key={`${part.type}-${index}`}
          className={
            FULL_SIZE_PARTS.has(part.type)
              ? undefined
              : cn(styles.small, "opacity-65")
          }
        >
          {part.value}
        </span>
      ))}
    </span>
  );
}
