"use client";

import { cn } from "@/lib/cn";
import { Input, NativeSelect } from "@/components/ui/Input";
import {
  DATE_RANGE_PRESET_LABELS,
  resolveDateRange,
  today,
  type DateRangePreset,
} from "@/lib/date";
import type { DateRange } from "@/types/common";

const PRESETS: DateRangePreset[] = [
  "today",
  "yesterday",
  "this-week",
  "this-month",
  "custom",
];

/**
 * Date range with the presets the specification lists, built from two native
 * date inputs rather than a picker dependency. Native inputs are keyboard
 * friendly, weigh nothing, and follow the terminal's own locale.
 */
export function DateRangeFilter({
  preset,
  range,
  onChange,
  className,
}: {
  preset: DateRangePreset;
  range: DateRange;
  onChange: (preset: DateRangePreset, range: DateRange) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label className="shrink-0">
        <span className="sr-only">Date range</span>
        <NativeSelect
          selectSize="sm"
          value={preset}
          onChange={(event) => {
            const next = event.target.value as DateRangePreset;
            onChange(next, resolveDateRange(next));
          }}
          className="w-auto min-w-36"
        >
          {PRESETS.map((option) => (
            <option key={option} value={option}>
              {DATE_RANGE_PRESET_LABELS[option]}
            </option>
          ))}
        </NativeSelect>
      </label>

      {preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <label>
            <span className="sr-only">From date</span>
            <Input
              type="date"
              inputSize="sm"
              max={range.to || today()}
              value={range.from}
              onChange={(event) =>
                onChange("custom", { ...range, from: event.target.value })
              }
              className="w-auto"
            />
          </label>
          <span className="text-meta text-neutral-400" aria-hidden>
            to
          </span>
          <label>
            <span className="sr-only">To date</span>
            <Input
              type="date"
              inputSize="sm"
              min={range.from}
              max={today()}
              value={range.to}
              onChange={(event) =>
                onChange("custom", { ...range, to: event.target.value })
              }
              className="w-auto"
            />
          </label>
        </div>
      )}
    </div>
  );
}
