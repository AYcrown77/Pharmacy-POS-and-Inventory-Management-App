"use client";

import { Minus, Plus, ScanBarcode, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/date";
import { formatMoney, formatQuantity, lineTotal } from "@/lib/money";
import type { SaleUnit } from "@/types/domain";
import { lineCeiling, switchLineUnit, type CartLine } from "../cart";

/**
 * The basket.
 *
 * Not a table element: each line needs a quantity stepper and a remove
 * control, and a grid gives those hit targets room without the alignment
 * fights a `<table>` would create at this density.
 */
export function CartTable({
  lines,
  lastTouchedKey,
  onAdjustQuantity,
  onSetQuantity,
  onSetUnit,
  onRemove,
  onFocusScan,
  disabled,
}: {
  lines: CartLine[];
  lastTouchedKey: string | null;
  onAdjustQuantity: (key: string, delta: number) => void;
  onSetQuantity: (key: string, quantity: number) => void;
  onSetUnit: (key: string, unit: SaleUnit) => void;
  onRemove: (key: string) => void;
  onFocusScan: () => void;
  disabled?: boolean;
}) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <ScanBarcode className="size-6" />
        </div>
        <div>
          <p className="text-section font-semibold text-neutral-900">
            Scan the first item
          </p>
          <p className="mt-0.5 text-base text-neutral-500">
            Scan a barcode, or search by name, generic or brand.
          </p>
        </div>
        <button
          type="button"
          onClick={onFocusScan}
          className="rounded-md px-3 py-1.5 text-meta font-medium text-primary-700 hover:bg-primary-50"
        >
          Focus the scan box (F2)
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Column headings, aligned to the row grid below. */}
      <div
        className="grid shrink-0 items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-micro font-semibold uppercase tracking-wide text-neutral-500"
        style={{ gridTemplateColumns: GRID }}
        aria-hidden
      >
        <span>Product</span>
        <span>Batch</span>
        <span className="text-center">Quantity</span>
        <span className="text-right">Price</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {lines.map((line) => (
          <CartRow
            key={line.key}
            line={line}
            ceiling={lineCeiling(lines, line)}
            canSwitchUnit={
              switchLineUnit(
                lines,
                line.key,
                line.unit === "PACK" ? "SINGLE" : "PACK",
              ) !== null
            }
            highlighted={line.key === lastTouchedKey}
            onAdjustQuantity={onAdjustQuantity}
            onSetQuantity={onSetQuantity}
            onSetUnit={onSetUnit}
            onRemove={onRemove}
            disabled={disabled}
          />
        ))}
      </ul>
    </div>
  );
}

const GRID = "minmax(0,1fr) 8.5rem 8.5rem 6.5rem 7rem 2rem";

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

function CartRow({
  line,
  ceiling,
  canSwitchUnit,
  highlighted,
  onAdjustQuantity,
  onSetQuantity,
  onSetUnit,
  onRemove,
  disabled,
}: {
  line: CartLine;
  /** The most of this line's unit the shelf can still supply. */
  ceiling: number;
  /** Whether the shelf could cover this line in the other unit. */
  canSwitchUnit: boolean;
  highlighted: boolean;
  onAdjustQuantity: (key: string, delta: number) => void;
  onSetQuantity: (key: string, quantity: number) => void;
  onSetUnit: (key: string, unit: SaleUnit) => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
}) {
  const atCeiling = line.quantity >= ceiling;
  const breaksDown = line.unitsPerPack > 1;
  const noun = (count: number) => {
    const singular = line.unit === "PACK" ? "pack" : line.baseUnitName;
    return count === 1 ? singular : `${singular}s`;
  };

  return (
    <li
      className={cn(
        "grid items-center gap-3 border-b border-neutral-100 px-4 py-2.5 transition-colors",
        highlighted && "bg-primary-50/60",
      )}
      style={{ gridTemplateColumns: GRID }}
    >
      <div className="min-w-0">
        <p className="truncate text-base font-medium text-neutral-900">
          {line.productName}
        </p>
        {line.description && (
          <p className="truncate text-meta text-neutral-500">
            {line.description}
          </p>
        )}

        {/* Only for products that come in packs. The unit is chosen per line
            rather than by the price list, so a trade buyer can take one loose
            sachet and a walk-in can take a whole box. */}
        {breaksDown && (
          <div
            role="group"
            aria-label={`Sell ${line.productName} by`}
            className="mt-1 inline-flex rounded-md bg-neutral-100 p-0.5"
          >
            {(["SINGLE", "PACK"] as const).map((unit) => {
              const selected = line.unit === unit;
              const blocked = !selected && !canSwitchUnit;
              return (
                <button
                  key={unit}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled || blocked}
                  title={
                    blocked
                      ? unit === "PACK"
                        ? "Not enough whole packs on the shelf"
                        : `Not enough ${line.baseUnitName}s on the shelf`
                      : undefined
                  }
                  onClick={() => {
                    if (!selected) onSetUnit(line.key, unit);
                  }}
                  className={cn(
                    "rounded px-2 py-0.5 text-micro font-medium transition-colors disabled:cursor-not-allowed",
                    selected
                      ? "bg-white text-primary-800 ring-1 ring-neutral-200"
                      : "text-neutral-600 hover:text-neutral-900 disabled:text-neutral-400",
                  )}
                >
                  {unit === "PACK"
                    ? `Pack of ${formatQuantity(line.unitsPerPack)}`
                    : capitalise(line.baseUnitName)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-w-0">
        {line.expectedBatchNumber ? (
          <>
            <p className="num truncate font-mono text-sm text-neutral-700">
              {line.expectedBatchNumber}
            </p>
            {line.expectedExpiry && (
              <p className="num truncate text-micro text-neutral-400">
                exp {formatDate(line.expectedExpiry)}
              </p>
            )}
          </>
        ) : (
          <span className="text-neutral-300">—</span>
        )}
      </div>

      <div className="flex items-center justify-center gap-1">
        <StepperButton
          label={`Decrease quantity of ${line.productName}`}
          onClick={() => onAdjustQuantity(line.key, -1)}
          disabled={disabled}
        >
          <Minus className="size-3.5" />
        </StepperButton>

        <input
          type="number"
          min={1}
          max={ceiling}
          value={line.quantity}
          disabled={disabled}
          aria-label={`Quantity of ${line.productName}, in ${noun(2)}`}
          onChange={(event) =>
            onSetQuantity(line.key, Number(event.target.value) || 1)
          }
          className="num h-8 w-12 rounded-md text-center text-base font-medium text-neutral-900 ring-1 ring-inset ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />

        <StepperButton
          label={
            atCeiling
              ? `Only ${formatQuantity(ceiling)} ${noun(ceiling)} of ${line.productName} available`
              : `Increase quantity of ${line.productName}`
          }
          onClick={() => onAdjustQuantity(line.key, 1)}
          disabled={disabled || atCeiling}
        >
          <Plus className="size-3.5" />
        </StepperButton>
      </div>

      <div className="text-right">
        <p className="num text-base text-neutral-700">
          {formatMoney(line.unitPrice)}
        </p>
        {breaksDown && (
          <p className="text-micro text-neutral-400">per {noun(1)}</p>
        )}
        {atCeiling && (
          <p className="num text-micro text-warning-700">
            max {formatQuantity(ceiling)}
          </p>
        )}
      </div>

      <p className="num text-right text-base font-semibold text-neutral-900">
        {formatMoney(lineTotal(line.unitPrice, line.quantity))}
      </p>

      <button
        type="button"
        onClick={() => onRemove(line.key)}
        disabled={disabled}
        aria-label={`Remove ${line.productName}`}
        className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function StepperButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-600 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
