"use client";

import { Segmented, type SegmentedItem } from "@/components/ui/segmented";
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
  className?: string;
};

/**
 * Row of tracker-selector pills, shared by the dashboard, schedules and
 * transactions pages. Drag-to-reorder is opt-in via
 * onDragStart/onDragEnd/onDrop — only the dashboard's list is reorderable.
 */
export function TrackerPillRow({
  trackers,
  activeTrackerId,
  onSelect,
  draggedTrackerId,
  onDragStart,
  onDragEnd,
  onDrop,
  className,
}: TrackerPillRowProps) {
  const draggable = Boolean(onDragStart || onDragEnd || onDrop);

  const items: SegmentedItem<string>[] = trackers.map((tracker) => ({
    value: tracker.id,
    label: tracker.isActive ? tracker.name : `${tracker.name} (Archiv)`,
    dot: tracker.color,
    buttonProps: draggable
      ? {
          draggable: true,
          onDragStart: () => onDragStart?.(tracker.id),
          onDragEnd: () => onDragEnd?.(),
          onDragOver: (event) => event.preventDefault(),
          onDrop: () => onDrop?.(tracker.id),
          className: cn(draggedTrackerId === tracker.id && "opacity-50"),
        }
      : undefined,
  }));

  return (
    <Segmented
      label="Tracker auswählen"
      items={items}
      value={activeTrackerId}
      onValueChange={onSelect}
      variant="solid"
      size="sm"
      className={className}
    />
  );
}
