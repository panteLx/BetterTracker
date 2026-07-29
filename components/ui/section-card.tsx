import { type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MicroLabel } from "@/components/ui/micro-label";
import { cn } from "@/lib/utils";

/**
 * A titled panel. The title is a micro-label rather than a heading-sized
 * string: on a page made of many panels, big panel titles compete with the
 * page title and with the numbers inside them.
 */
type SectionCardProps = {
  title?: string;
  titleRight?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** For panels whose content owns its own edges, e.g. a full-bleed table. */
  noPadding?: boolean;
};

export function SectionCard({
  title,
  titleRight,
  children,
  className,
  contentClassName,
  noPadding = false,
}: SectionCardProps) {
  return (
    <Card className={className}>
      {title ? (
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <MicroLabel>{title}</MicroLabel>
            {titleRight}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={cn(noPadding && "px-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
