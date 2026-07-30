"use client";

import { useId } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

/**
 * The sparkline lives in its own client boundary so `StatTile` itself can
 * still be rendered from a Server Component (it's used directly in
 * `app/t/[slug]/page.tsx`, which passes lucide icon components as props —
 * those can only cross the server/client boundary if `StatTile` stays a
 * plain, hook-free component).
 */
export function StatTileTrend({
  trend,
  color,
  inverse,
}: {
  trend: number[];
  color: string;
  inverse: boolean;
}) {
  const gradientId = `stat-tile-trend-${useId()}`;

  return (
    <div
      className={cn("mt-2 -mb-1 h-6 w-full", inverse ? "opacity-40" : "opacity-70")}
      style={{ color }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={trend.map((v, i) => ({ i, v }))}
          margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="currentColor" stopOpacity={0.35} />
              <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="currentColor"
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
