"use client";

import { createPortal } from "react-dom";

import { Barcode, code128Pattern } from "./Barcode";
import { cn } from "@/lib/cn";
import {
  LABEL_EDGE_MM,
  ROLL_PRINTABLE_WIDTH_MM,
  fitBarcode,
  toWholeDotsMm,
  type LabelSetup,
} from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { UNIT_TYPE_LABELS } from "@/lib/status";
import type { PharmacySettings, Product } from "@/types/domain";

/**
 * How the product's barcode sits on this stock, or null when it has none.
 * The dialog uses the same answer to warn before a label that cannot scan is
 * printed.
 */
export function labelBarcodeFit(product: Product, setup: LabelSetup) {
  const pattern = product.barcode ? code128Pattern(product.barcode) : null;
  if (!pattern) return null;

  const labelWidthMm =
    setup.kind === "STICKER" ? setup.widthMm : ROLL_PRINTABLE_WIDTH_MM;
  return fitBarcode(pattern.length, labelWidthMm, setup.dpi);
}

/**
 * A shelf / pack label.
 *
 * On a sticker the label is exactly the sticker, so nothing essential can land
 * in the gap between two of them. What a person reads is the name and the
 * price, so those lead; the barcode takes whatever height is left.
 */
export function ProductLabel({
  product,
  settings,
  setup,
}: {
  product: Product;
  settings?: PharmacySettings | undefined;
  setup: LabelSetup;
}) {
  const sticker = setup.kind === "STICKER";
  // A 25mm sticker has room for the name, the price and a barcode tall enough
  // to aim at — not for the strength line and the pharmacy name as well.
  const roomy = !sticker || setup.heightMm >= 30;
  const fit = labelBarcodeFit(product, setup);
  // The edge is a whole number of dots as well, so the barcode's whole-dot
  // offset is measured from a point already on the head's grid.
  const edgeMm = toWholeDotsMm(LABEL_EDGE_MM, setup.dpi);
  const unit = (UNIT_TYPE_LABELS[product.unitType] ?? "unit").toLowerCase();
  const detail = [product.strength, product.dosageForm?.toLowerCase()]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "flex flex-col items-center overflow-hidden bg-white text-center font-sans text-black",
        sticker
          ? "break-after-page last:break-after-auto"
          : "break-inside-avoid border-b border-dashed border-black py-[2mm]",
      )}
      style={
        sticker
          ? {
              width: `${setup.widthMm}mm`,
              // A hair under the page, so rounding can never spill a label onto
              // a second page and shift every label after it off its sticker.
              height: `${setup.heightMm - 0.4}mm`,
              padding: `${edgeMm}mm`,
              gap: "0.4mm",
            }
          : {
              width: "var(--receipt-width)",
              paddingInline: `${edgeMm}mm`,
              gap: "0.6mm",
            }
      }
    >
      <p className="w-full truncate text-[7.5pt] font-bold leading-tight">
        {product.name}
      </p>

      {roomy && detail && (
        <p className="w-full truncate text-[6.5pt] leading-tight">{detail}</p>
      )}

      {/* Per base unit, and it says so — a box of 20 capsules is not ₦2,000. */}
      <p className="whitespace-nowrap text-[11pt] font-bold leading-none tabular-nums">
        {formatMoney(product.priceConsumer)}
        <span className="text-[6.5pt] font-normal"> / {unit}</span>
      </p>

      {product.barcode ? (
        <Barcode
          value={product.barcode}
          moduleMm={fit?.moduleMm ?? 0.25}
          offsetMm={fit?.offsetMm}
          barHeight={sticker ? undefined : "10mm"}
          className={cn("w-full text-[7pt]", sticker && "flex-1")}
        />
      ) : (
        // Nothing to encode. Saying so is better than a blank space that looks
        // like a printer fault.
        <p className="text-[6.5pt] italic">No barcode assigned</p>
      )}

      {roomy && settings?.name && (
        <p className="w-full truncate text-[5.5pt] uppercase tracking-wide">
          {settings.name}
        </p>
      )}
    </div>
  );
}

/**
 * The labels that actually print.
 *
 * Mounted straight under `<body>`. Stickers print one per page, and pages only
 * break in normal flow — so for a sticker job the print styles take every
 * other child of body out of the document and let this strip flow from the top
 * of the first page (see globals.css). On screen it sits far off to the left;
 * the print rules move it onto the paper.
 */
export function ProductLabelStrip({
  product,
  copies,
  settings,
  setup,
}: {
  product: Product;
  copies: number;
  settings?: PharmacySettings | undefined;
  setup: LabelSetup;
}) {
  if (typeof document === "undefined") return null;

  const sticker = setup.kind === "STICKER";

  return createPortal(
    <div
      data-print-root={sticker ? "stickers" : "labels"}
      aria-hidden
      className="pointer-events-none fixed left-[-200vw] top-0 bg-white"
      style={{ width: sticker ? `${setup.widthMm}mm` : "var(--receipt-width)" }}
    >
      {Array.from({ length: Math.max(1, copies) }, (_, index) => (
        <ProductLabel
          key={index}
          product={product}
          settings={settings}
          setup={setup}
        />
      ))}
    </div>,
    document.body,
  );
}
