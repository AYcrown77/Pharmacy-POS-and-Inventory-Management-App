"use client";

import { formatDate, formatTime, timestampToDateOnly } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/status";
import type { PharmacySettings, Sale } from "@/types/domain";

/**
 * The till receipt, sized by the calibration variables in `globals.css`.
 *
 * Rendered into the page but parked off-screen: the print stylesheet in
 * `globals.css` hides everything except `[data-print-root]`, and an element
 * with `display: none` would not print either. Moving it off-screen keeps it
 * out of the way while leaving it printable.
 *
 * The width is the printer's printable area, not the paper: an 80mm roll
 * marks only 72mm. Every row still has to survive a value longer than its
 * column, so labels hold their width and values wrap rather than truncate —
 * a receipt is a record, and silently dropping the end of a name is worse
 * than a second line.
 *
 * Set in the sans face, not monospace, for one measured reason: JetBrains
 * Mono has no naira glyph, so ₦ fell back to a proportional font 62% wider
 * than the character cell (10.69px against 6.60px) and knocked every money
 * value out of line. Inter carries ₦, and the layout aligns with flexbox and
 * `tabular-nums` rather than by counting characters, so nothing is lost.
 *
 * Browser printing rasterises the page, so the printer reproduces whatever is
 * rendered here — it is not limited to the printer's own character set.
 */
export function ReceiptDocument({
  sale,
  settings,
}: {
  sale: Sale;
  settings: PharmacySettings | undefined;
}) {
  const pharmacyName = settings?.name ?? "Mustan Healthcare Pharmacy";

  return (
    <div
      data-print-root="receipt"
      aria-hidden
      // Off-screen on a monitor; the print rules reposition it to the page.
      // Width comes from the calibration variable in globals.css so the
      // preview here and the print are the same measurement.
      className="pointer-events-none fixed left-[-200vw] top-0 w-[var(--receipt-width)] bg-white px-2 py-3 font-sans text-[11px] leading-[1.5] tabular-nums text-black"
    >
      <header className="text-center">
        <p className="text-[13px] font-bold uppercase tracking-wide">
          {pharmacyName}
        </p>
        {settings?.address && <p>{settings.address}</p>}
        {settings?.phone && <p>Tel: {settings.phone}</p>}
      </header>

      <Divider />

      <div className="flex flex-col gap-0.5">
        <Line label="Receipt" value={sale.receiptNumber} />
        <Line label="Cashier" value={sale.cashierName} />
        <Line label="Terminal" value={sale.terminalName} />
        <Line
          label="Date"
          value={formatDate(timestampToDateOnly(sale.createdAt))}
        />
        <Line label="Time" value={formatTime(sale.createdAt)} />
      </div>

      <Divider />

      <div className="flex flex-col gap-1">
        {sale.items.map((item) => (
          <div key={item.id}>
            <p className="break-words">{item.productName}</p>
            <div className="flex justify-between gap-1.5 tabular-nums">
              <span>
                {formatQuantity(item.quantity)} x {formatMoney(item.unitPrice)}
              </span>
              <span className="shrink-0">{formatMoney(item.subtotal)}</span>
            </div>
            {item.returnedQuantity > 0 && (
              <p className="tabular-nums">
                ({formatQuantity(item.returnedQuantity)} returned)
              </p>
            )}
          </div>
        ))}
      </div>

      <Divider />

      <div className="flex flex-col gap-0.5 tabular-nums">
        <Line label="Subtotal" value={formatMoney(sale.subtotal)} />
        {sale.discount > 0 && (
          <Line label="Discount" value={`-${formatMoney(sale.discount)}`} />
        )}
        <div className="mt-0.5 flex justify-between text-[13px] font-bold">
          <span>TOTAL</span>
          <span>{formatMoney(sale.total)}</span>
        </div>
      </div>

      <Divider />

      <div className="flex flex-col gap-0.5 tabular-nums">
        <Line
          label="Payment"
          value={PAYMENT_METHOD_LABELS[sale.paymentMethod]}
        />
        {sale.amountReceived !== null && (
          <Line label="Received" value={formatMoney(sale.amountReceived)} />
        )}
        {sale.changeGiven !== null && (
          <Line label="Change" value={formatMoney(sale.changeGiven)} />
        )}
      </div>

      {sale.status !== "COMPLETED" && (
        <>
          <Divider />
          <p className="text-center font-bold uppercase">
            {sale.status === "REVERSED" ? "Sale reversed" : "Partially returned"}
          </p>
        </>
      )}

      <Divider />

      {/*
        The tagline is whatever Settings holds, not a second hardcoded copy of
        it — the seeded footer is the tagline, so printing both put "Your
        Health, Our Priority" on every receipt twice.
      */}
      <footer className="text-center">
        <p className="font-bold">
          {settings?.receiptFooter ?? "Your Health, Our Priority"}
        </p>
        <p>Thank you for your patronage.</p>
      </footer>
    </div>
  );
}

/**
 * A border rather than a row of hyphens: an ASCII rule only spans the paper
 * if the face is truly monospaced, which this one is not.
 */
function Divider() {
  return <hr className="my-1.5 border-t border-dashed border-black" />;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-1.5">
      <span className="shrink-0">{label}</span>
      <span className="break-words text-right">{value}</span>
    </div>
  );
}

