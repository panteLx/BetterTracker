import { type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title?: string;
  titleRight?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
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
    <Card className={cn("border-border/60", className)}>
      {title ? (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {titleRight}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={cn(noPadding ? "p-0" : "pt-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
