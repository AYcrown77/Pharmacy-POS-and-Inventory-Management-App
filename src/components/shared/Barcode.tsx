"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/**
 * Code 128 covers printable ASCII and nothing else.
 *
 * Checked here rather than by catching a throw, so the decision is made during
 * render: setting state from an effect to report the failure afterwards would
 * render once with a barcode that is not there.
 */
function isEncodable(value: string): boolean {
  return value.length > 0 && /^[\x20-\x7E]+$/.test(value);
}

/**
 * A scannable barcode, rendered as SVG.
 *
 * **Code 128, always — deliberately, even for 13-digit codes that look like
 * EAN-13.** Most of the codes in this catalogue are not valid EAN-13: their
 * check digits do not compute. Asked to encode one as EAN-13, a generator
 * either refuses or silently substitutes the correct check digit, and then the
 * label scans back as a *different* number from the one stored against the
 * product. A label that does not scan is an annoyance; a label that scans as
 * the wrong product is a dispensing error. Code 128 encodes the string exactly
 * as given, so what is printed always matches what is in the database.
 *
 * SVG rather than canvas because a thermal head is coarse — 203dpi — and
 * vector bars stay sharp when the browser rasterises the page for printing.
 */
export function Barcode({
  value,
  /** Bar width in px. Below 1.6 a 203dpi head starts merging bars. */
  barWidth = 1.8,
  height = 38,
  showValue = true,
  className,
}: {
  value: string;
  barWidth?: number;
  height?: number;
  showValue?: boolean;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const encodable = isEncodable(value);

  useEffect(() => {
    if (!ref.current || !encodable) return;

    JsBarcode(ref.current, value, {
      format: "CODE128",
      width: barWidth,
      height,
      displayValue: showValue,
      // The human-readable line is the fallback when a scan fails, so it has
      // to be legible on thermal paper rather than merely present.
      font: "Inter Variable, sans-serif",
      fontSize: 11,
      textMargin: 1,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
    });
  }, [value, barWidth, height, showValue, encodable]);

  if (!encodable) {
    return (
      <p className={className}>
        <span className="font-mono">{value || "No barcode"}</span>
      </p>
    );
  }

  return <svg ref={ref} className={className} />;
}
