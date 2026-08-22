"use client";

import { useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const DATE_FNS_LOCALES = { "de-DE": de, "en-US": enUS } as const;
const DISPLAY_FORMATS = { "de-DE": "dd.MM.yyyy", "en-US": "MM/dd/yyyy" } as const;
const FIELD_ORDERS = {
  "de-DE": ["d", "M", "y"],
  "en-US": ["M", "d", "y"],
} as const satisfies Record<keyof typeof DATE_FNS_LOCALES, ("d" | "M" | "y")[]>;

type SupportedLocale = keyof typeof DATE_FNS_LOCALES;

type DatePickerProps = {
  id?: string;
  "aria-label"?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parseISO(value);
  return isValid(d) ? d : undefined;
}

// Mirrors the classic two-digit-year pivot (as used by e.g. POSIX strptime
// %y): 00-68 lands in the 2000s, 69-99 in the 1900s. Fixed rather than
// sliding with the current year, so a typed date parses the same way
// regardless of when it's entered.
function expandTwoDigitYear(year: number) {
  return year < 69 ? 2000 + year : 1900 + year;
}

/**
 * Splits a run of digits with no separators into the same 3-part shape a
 * separated date has, so e.g. "18111999" / "181199" parse the same way as
 * "18.11.1999" / "18.11.99" — 8 digits as 2/2/4 (day/month/year), 6 digits
 * as 2/2/2, in the locale's field order.
 */
function splitContiguousDigits(digits: string): string[] | null {
  if (digits.length === 8) {
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  }
  if (digits.length === 6) {
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];
  }
  return null;
}

/**
 * Parses free-typed text in the locale's field order (see FIELD_ORDERS) into
 * an ISO "yyyy-MM-dd" string. Returns "" for a cleared field, null if the
 * text isn't a parseable date.
 */
function parseTypedDate(text: string, locale: SupportedLocale): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const rawParts = trimmed.split(/[^\d]+/).filter(Boolean);
  const parts =
    rawParts.length === 1 ? (splitContiguousDigits(rawParts[0]) ?? rawParts) : rawParts;
  if (parts.length !== 3) return null;

  const order = FIELD_ORDERS[locale];
  const yearIndex = order.indexOf("y");
  const monthIndex = order.indexOf("M");
  const dayIndex = order.indexOf("d");

  let year = Number(parts[yearIndex]);
  const month = Number(parts[monthIndex]);
  const day = Number(parts[dayIndex]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (parts[yearIndex].length <= 2) {
    year = expandTwoDigitYear(year);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  const rolledOver =
    date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day;
  if (rolledOver) return null;

  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  id,
  "aria-label": ariaLabel,
  value,
  onChange,
  disabled,
  placeholder,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const date = toDate(value);
  const locale = useLocale();
  const t = useTranslations("Common.datePicker");
  const dateFnsLocale = DATE_FNS_LOCALES[locale];
  const displayFormat = DISPLAY_FORMATS[locale];

  function formatValue(v: string) {
    const d = toDate(v);
    return d ? format(d, displayFormat, { locale: dateFnsLocale }) : "";
  }

  // Local editable text, resynced from `value` whenever it changes from the
  // outside (calendar pick, form reset) — but never mid-typing, since typing
  // doesn't update `value` until commit(). Adjusting state during render
  // rather than in an effect, per https://react.dev/learn/you-might-not-need-an-effect.
  const [text, setText] = useState(() => formatValue(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(formatValue(value));
  }

  function commit() {
    const parsed = parseTypedDate(text, locale);
    if (parsed === null) {
      // Unparseable — revert to the last known-good value instead of
      // silently submitting garbage.
      setText(formatValue(value));
      return;
    }
    setText(formatValue(parsed));
    setLastValue(parsed);
    if (parsed !== value) {
      onChange(parsed);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        aria-label={ariaLabel}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder ?? t("placeholder")}
        disabled={disabled}
        className="pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("openCalendar")}
            disabled={disabled}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(selected) => {
              if (selected) {
                const iso = format(selected, "yyyy-MM-dd");
                setText(formatValue(iso));
                setLastValue(iso);
                onChange(iso);
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
