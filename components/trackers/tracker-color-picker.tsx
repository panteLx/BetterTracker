"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { PaintBucket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TRACKER_COLOR_PRESETS } from "@/lib/tracker-defaults";

type TrackerColorPickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

export function TrackerColorPicker({
  id,
  value,
  onChange,
  className,
}: TrackerColorPickerProps) {
  const [textValue, setTextValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  function handleTextChange(nextValue: string) {
    setTextValue(nextValue);

    if (HEX_COLOR_PATTERN.test(nextValue)) {
      onChange(nextValue.toLowerCase());
    }
  }

  function handleTextBlur() {
    setIsEditing(false);

    if (!HEX_COLOR_PATTERN.test(textValue)) {
      setTextValue(value);
      return;
    }

    const normalized = textValue.toLowerCase();
    setTextValue(normalized);
    onChange(normalized);
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-14 shrink-0 rounded-xl px-0"
            aria-label="Farbe auswählen"
          >
            <span
              className="h-6 w-6 rounded-full border border-black/10 shadow-sm"
              style={{ backgroundColor: value }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[260px] space-y-4 rounded-2xl">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PaintBucket className="h-4 w-4" />
            Tracker-Farbe
          </div>
          <HexColorPicker color={value} onChange={onChange} className="h-40! w-full!" />
          <div className="grid grid-cols-4 gap-2">
            {TRACKER_COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                className={cn(
                  "h-8 rounded-lg border transition hover:scale-[1.03]",
                  preset === value ? "border-foreground" : "border-border/70"
                )}
                style={{ backgroundColor: preset }}
                aria-label={`Farbe ${preset}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Input
        id={id}
        value={isEditing ? textValue : value}
        onFocus={() => setIsEditing(true)}
        onChange={(event) => handleTextChange(event.target.value)}
        onBlur={handleTextBlur}
        placeholder="#0f766e"
        className="font-mono uppercase"
      />
    </div>
  );
}
