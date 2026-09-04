"use client";

import { Minus, Plus, ScanBarcode, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/date";
import { formatMoney, formatQuantity, lineTotal } from "@/lib/money";
import { isLineAtStockCeiling, type CartLine } from "../cart";

/**
 * The basket.
 *
 * Not a table element: each line needs a quantity stepper and a remove
 * control, and a grid gives those hit targets room without the alignment
 * fights a `<table>` would create at this density.
 */
export function CartTable({
  lines,
  lastTouchedProductId,
  onAdjustQuantity,
  onSetQuantity,
  onRemove,
  onFocusScan,
  disabled,
}: {
  lines: CartLine[];
  lastTouchedProductId: string | null;
  onAdjustQuantity: (productId: string, delta: number) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
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
        <span className="text-right">Unit price</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {lines.map((line) => (
          <CartRow
            key={line.productId}
            line={line}
            highlighted={line.productId === lastTouchedProductId}
            onAdjustQuantity={onAdjustQuantity}
            onSetQuantity={onSetQuantity}
            onRemove={onRemove}
            disabled={disabled}
          />
        ))}
      </ul>
    </div>
  );
}

const GRID = "minmax(0,1fr) 8.5rem 8.5rem 6.5rem 7rem 2rem";

function CartRow({
  line,
  highlighted,
  onAdjustQuantity,
  onSetQuantity,
  onRemove,
  disabled,
}: {
  line: CartLine;
  highlighted: boolean;
  onAdjustQuantity: (productId: string, delta: number) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  disabled?: boolean;
}) {
  const atCeiling = isLineAtStockCeiling(line);

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
          onClick={() => onAdjustQuantity(line.productId, -1)}
          disabled={disabled}
        >
          <Minus className="size-3.5" />
        </StepperButton>

        <input
          type="number"
          min={1}
          max={line.availableStock}
          value={line.quantity}
          disabled={disabled}
          aria-label={`Quantity of ${line.productName}`}
          onChange={(event) =>
            onSetQuantity(line.productId, Number(event.target.value) || 1)
          }
          className="num h-8 w-12 rounded-md text-center text-base font-medium text-neutral-900 ring-1 ring-inset ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />

        <StepperButton
          label={
            atCeiling
              ? `Only ${line.availableStock} of ${line.productName} available`
              : `Increase quantity of ${line.productName}`
          }
          onClick={() => onAdjustQuantity(line.productId, 1)}
          disabled={disabled || atCeiling}
        >
          <Plus className="size-3.5" />
        </StepperButton>
      </div>

      <div className="text-right">
        <p className="num text-base text-neutral-700">
          {formatMoney(line.unitPrice)}
        </p>
        {atCeiling && (
          <p className="num text-micro text-warning-700">
            max {formatQuantity(line.availableStock)}
          </p>
        )}
      </div>

      <p className="num text-right text-base font-semibold text-neutral-900">
        {formatMoney(lineTotal(line.unitPrice, line.quantity))}
      </p>

      <button
        type="button"
        onClick={() => onRemove(line.productId)}
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
