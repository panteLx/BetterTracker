"use client";

import { cn } from "@/lib/utils";

type PillTracker = {
  id: string;
  name: string;
  color?: string | null;
  isActive: boolean;
};

type TrackerPillRowProps = {
  trackers: PillTracker[];
  activeTrackerId: string;
  onSelect: (id: string) => void;
  /** Enables drag-to-reorder (used by the dashboard's tracker selector). */
  draggedTrackerId?: string;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onDrop?: (targetId: string) => void;
};

/**
 * Row of tracker-selector pills, shared by the dashboard, schedules, and
 * transactions pages — all three rendered the exact same button markup
 * independently. Drag-to-reorder is opt-in via onDragStart/onDragEnd/onDrop
 * (only the dashboard's tracker list is reorderable).
 */
export function TrackerPillRow({
  trackers,
  activeTrackerId,
  onSelect,
  draggedTrackerId,
  onDragStart,
  onDragEnd,
  onDrop,
}: TrackerPillRowProps) {
  const draggable = Boolean(onDragStart || onDragEnd || onDrop);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {trackers.map((item) => {
        const isActive = item.id === activeTrackerId;
        return (
          <button
            key={item.id}
            type="button"
            draggable={draggable}
            aria-label={draggable ? `Tracker ${item.name} auswählen` : undefined}
            aria-pressed={draggable ? isActive : undefined}
            onClick={() => onSelect(item.id)}
            onDragStart={draggable ? () => onDragStart?.(item.id) : undefined}
            onDragEnd={draggable ? () => onDragEnd?.() : undefined}
            onDragOver={draggable ? (event) => event.preventDefault() : undefined}
            onDrop={draggable ? () => onDrop?.(item.id) : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
              isActive
                ? "border-transparent bg-foreground text-background shadow-sm"
                : "border-border/70 bg-background/75 text-foreground hover:bg-accent",
              draggable && draggedTrackerId === item.id && "opacity-60",
            )}
          >
            {item.color ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            ) : null}
            {item.name}
            {!item.isActive ? " (Archiv)" : ""}
          </button>
        );
      })}
    </div>
  );
}
