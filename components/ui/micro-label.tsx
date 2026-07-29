import { cn } from "@/lib/utils";

/**
 * The caption tier: a tiny uppercase label that names a number or a section.
 * Set in Geist (see `.type-label` in globals.css) so it reads as a different
 * voice from the Poppins titles around it.
 */
export function MicroLabel({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="micro-label"
      className={cn("type-label block", className)}
      {...props}
    />
  );
}
