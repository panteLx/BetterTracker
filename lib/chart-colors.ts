"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

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

function readColors(): ChartColors {
  if (typeof window === "undefined") {
    return {
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
  }

  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim();

  return {
    income: get("--income") || "oklch(0.55 0.16 155)",
    expense: get("--expense") || "oklch(0.58 0.22 25)",
    chart1: get("--chart-1") || "oklch(0.60 0.16 185)",
    chart2: get("--chart-2") || "oklch(0.62 0.17 155)",
    chart3: get("--chart-3") || "oklch(0.60 0.15 230)",
    chart4: get("--chart-4") || "oklch(0.58 0.19 280)",
    chart5: get("--chart-5") || "oklch(0.72 0.17 60)",
    chart6: get("--chart-6") || "oklch(0.60 0.21 15)",
    chart7: get("--chart-7") || "oklch(0.65 0.14 200)",
    chart8: get("--chart-8") || "oklch(0.56 0.21 300)",
  };
}

export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(readColors);

  useEffect(() => {
    setColors(readColors());
  }, [resolvedTheme]);

  return colors;
}
