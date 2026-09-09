"use client";

import { Barcode } from "./Barcode";
import { formatMoney } from "@/lib/money";
import type { PharmacySettings, Product } from "@/types/domain";

/**
 * A shelf-edge / product label for the till roll.
 *
 * Sized by the same `--receipt-width` calibration as the receipt, because it
 * comes off the same printer. What a person reads at the shelf is the name and
 * the price, so those lead; the barcode is for the scanner and the digits
 * under it are the fallback for when a label gets scuffed.
 */
export function ProductLabel({
  product,
  settings,
}: {
  product: Product;
  settings?: PharmacySettings | undefined;
}) {
  const strength = [product.strength, product.dosageForm?.toLowerCase()]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex w-[var(--receipt-width)] break-inside-avoid flex-col items-center gap-0.5 border-b border-dashed border-black px-1 py-2 text-center font-sans text-black">
      <p className="w-full text-[10px] font-bold leading-tight break-words">
        {product.name}
      </p>

      {strength && <p className="text-[9px] leading-tight">{strength}</p>}

      <p className="text-[15px] font-bold leading-none tabular-nums">
        {formatMoney(product.priceConsumer)}
      </p>

      {product.barcode ? (
        <Barcode value={product.barcode} height={30} barWidth={1.6} />
      ) : (
        // Nothing to encode. Saying so on the label is better than printing a
        // blank space that looks like a printer fault.
        <p className="text-[9px] italic">No barcode assigned</p>
      )}

      {settings?.name && (
        <p className="text-[8px] uppercase tracking-wide">{settings.name}</p>
      )}
    </div>
  );
}

/**
 * A strip of labels for one product.
 *
 * The receipt printer takes a continuous roll rather than a die-cut sheet, so
 * copies print end to end with a dashed line to cut along.
 */
export function ProductLabelStrip({
  product,
  copies,
  settings,
}: {
  product: Product;
  copies: number;
  settings?: PharmacySettings | undefined;
}) {
  return (
    <div
      data-print-root="labels"
      aria-hidden
      // Off-screen on a monitor, and — critically — the positioning lives on
      // the print root itself rather than a wrapper. The print rule overrides
      // this element's `left` to 0 to pull it onto the page; if the offset sat
      // on a parent instead, that parent would become the containing block and
      // the label would still be rendered 200 viewport widths away, printing a
      // blank sheet.
      className="pointer-events-none fixed left-[-200vw] top-0 w-[var(--receipt-width)] bg-white"
    >
      {Array.from({ length: Math.max(1, copies) }, (_, index) => (
        <ProductLabel key={index} product={product} settings={settings} />
      ))}
    </div>
  );
}
