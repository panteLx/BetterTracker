import { type ReactNode, type ElementType } from "react";
import { cn } from "@/lib/utils";

/**
 * An empty screen is an invitation to act, so it always names the next step
 * rather than just reporting that there is nothing here.
 */
type EmptyStateProps = {
  icon?: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm font-subtext text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
