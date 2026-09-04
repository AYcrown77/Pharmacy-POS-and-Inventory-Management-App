"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import type { SalesTrendPoint } from "@/types/analytics";

/**
 * Daily takings.
 *
 * Bars, not a line: each day is a discrete bucket that gets totalled and
 * closed, and a line would imply takings flowed continuously between them.
 *
 * One series, so there is no legend — the panel title names it. The fill is
 * primary-500 (#2A5EAB), which is the step that clears the lightness band for
 * a data mark; primary-700 from the brand palette is too dark to sit on white.
 */

const BAR_FILL = "#2A5EAB";
const GRID = "#ECEFF3";
const AXIS_TEXT = "#6E7784";

/** Compact naira for the axis — full precision belongs in the tooltip. */
function axisMoney(kobo: number): string {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}m`;
  if (naira >= 1_000) return `₦${Math.round(naira / 1_000)}k`;
  return `₦${naira}`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SalesTrendPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md bg-neutral-900 px-3 py-2 text-meta text-white shadow-overlay">
      <p className="font-medium">{formatDate(point.date)}</p>
      <p className="num mt-1 text-white/90">{formatMoney(point.total)}</p>
      <p className="num text-white/60">
        {formatQuantity(point.transactions)}{" "}
        {point.transactions === 1 ? "transaction" : "transactions"}
      </p>
    </div>
  );
}

export function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  return (
    <div className="h-56 w-full px-2 pb-2 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 4 }}
          barCategoryGap="28%"
        >
          {/* Recessive grid: horizontal only, so it guides the eye to values
              without drawing a cage around the data. */}
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            dy={4}
          />
          <YAxis
            tickFormatter={axisMoney}
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            width={52}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "#12448B", fillOpacity: 0.06 }}
          />
          {/* 4px rounded data-ends, anchored to the baseline. `maxBarSize`
              keeps a short range from rendering absurdly wide bars. */}
          <Bar
            dataKey="total"
            fill={BAR_FILL}
            radius={[4, 4, 0, 0]}
            maxBarSize={64}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
