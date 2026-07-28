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

const DEFAULTS: ChartColors = {
  income: "oklch(0.55 0.16 155)",
  expense: "oklch(0.58 0.22 25)",
  chart1: "oklch(0.60 0.16 185)",
  chart2: "oklch(0.62 0.17 155)",
  chart3: "oklch(0.60 0.15 230)",
  chart4: "oklch(0.58 0.19 280)",
  chart5: "oklch(0.72 0.17 60)",
  chart6: "oklch(0.60 0.21 15)",
  chart7: "oklch(0.65 0.14 200)",
  chart8: "oklch(0.56 0.21 300)",
};

function readColors(): ChartColors {
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

function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
  return () => observer.disconnect();
}

export function useChartColors(): ChartColors {
  return useSyncExternalStore(subscribe, readColors, () => DEFAULTS);
}
