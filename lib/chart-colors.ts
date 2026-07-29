"use client";

import { useSyncExternalStore } from "react";

export type ChartColors = {
  income: string;
  expense: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  chart7: string;
  chart8: string;
};

// Server-render fallback only — mirrors the light-theme values in globals.css.
const DEFAULTS: ChartColors = {
  income: "#16a34a",
  expense: "#dc2626",
  chart1: "#2a78d6",
  chart2: "#eb6834",
  chart3: "#1baf7a",
  chart4: "#eda100",
  chart5: "#e87ba4",
  chart6: "#008300",
  chart7: "#4a3aa7",
  chart8: "#e34948",
};

function readColorsFromDOM(): ChartColors {
  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim();
  return {
    income: get("--income") || DEFAULTS.income,
    expense: get("--expense") || DEFAULTS.expense,
    chart1: get("--chart-1") || DEFAULTS.chart1,
    chart2: get("--chart-2") || DEFAULTS.chart2,
    chart3: get("--chart-3") || DEFAULTS.chart3,
    chart4: get("--chart-4") || DEFAULTS.chart4,
    chart5: get("--chart-5") || DEFAULTS.chart5,
    chart6: get("--chart-6") || DEFAULTS.chart6,
    chart7: get("--chart-7") || DEFAULTS.chart7,
    chart8: get("--chart-8") || DEFAULTS.chart8,
  };
}

// Module-level cache — only replaced when the DOM actually changes.
// useSyncExternalStore requires getSnapshot to return the same reference
// between updates, otherwise React enters an infinite re-render loop.
let snapshot: ChartColors | null = null;

function getSnapshot(): ChartColors {
  if (!snapshot) {
    snapshot = readColorsFromDOM();
  }
  return snapshot;
}

function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(() => {
    snapshot = readColorsFromDOM();
    callback();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "data-scheme"],
  });
  return () => observer.disconnect();
}

export function useChartColors(): ChartColors {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULTS);
}
