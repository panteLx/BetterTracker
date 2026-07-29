import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status badges are soft-filled rather than solid: they sit next to amounts
 * and titles all day, and a saturated block of color there reads as an alarm
 * even when it only means "expense".
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-pill border px-2 py-0.5 font-subtext text-[11px] font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring/60 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-card text-muted-foreground",
        income: "border-transparent bg-income-muted text-income",
        expense: "border-transparent bg-expense-muted text-expense",
        warning: "border-transparent bg-warning-muted text-warning",
        info: "border-transparent bg-info-muted text-info",
        destructive: "border-transparent bg-expense-muted text-expense",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
