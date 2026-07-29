import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amountCents: number,
  currency = "EUR",
  locale = "de-DE"
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export function formatDateTime(
  value: string | number | Date,
  locale = "de-DE",
  timezone = "Europe/Berlin"
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseAmountToCents(value: string | number) {
  const normalized = String(value).trim().replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function toDateInputValue(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function amountToInputValue(amountCents: number) {
  return (amountCents / 100).toFixed(2).replace(".", ",");
}

export function sortByName<T extends { name: string }>(items: T[], locale: string): T[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, locale));
}

export function getFrequencyLabel(
  frequency: "monthly" | "yearly" | "custom_days",
  intervalValue: number
): string {
  if (frequency === "monthly") {
    return intervalValue === 1 ? "Monatlich" : `Alle ${intervalValue} Monate`;
  }
  if (frequency === "yearly") {
    return intervalValue === 1 ? "Jährlich" : `Alle ${intervalValue} Jahre`;
  }
  return intervalValue === 1 ? "Täglich" : `Alle ${intervalValue} Tage`;
}

/** Sentinel for select components that can't represent "no selection" as an empty string value. */
export const EMPTY_SELECT_VALUE = "none";

