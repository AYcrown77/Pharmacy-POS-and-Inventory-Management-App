"use client";

import JsBarcode from "jsbarcode";

import { cn } from "@/lib/cn";
import { QUIET_ZONE_MODULES } from "@/lib/labels";

/** Code 128 covers printable ASCII and nothing else. */
function isEncodable(value: string): boolean {
  return value.length > 0 && /^[\x20-\x7E]+$/.test(value);
}

/**
 * The Code 128 module pattern for a value — "1" a dark module, "0" a light
 * one — or null when it cannot be encoded.
 *
 * **Code 128, always — deliberately, even for 13-digit codes that look like
 * EAN-13.** Many codes in the catalogue are not valid EAN-13: their check
 * digits do not compute. Asked to encode one as EAN-13, a generator either
 * refuses or silently substitutes the correct check digit, and the label then
 * scans back as a *different* number from the one stored against the product.
 * A label that does not scan is an annoyance; a label that scans as the wrong
 * product is a dispensing error. Code 128 encodes the string exactly as given.
 *
 * JsBarcode is asked for the encoding only, through its object renderer. Its
 * own SVG sizes bars in CSS pixels, which land on fractional printer dots, so
 * the bars are drawn here instead.
 */
export function code128Pattern(value: string): string | null {
  if (!isEncodable(value)) return null;

  const target: { encodings?: { data: string }[] } = {};
  try {
    JsBarcode(target, value, { format: "CODE128" });
  } catch {
    return null;
  }

  const pattern = target.encodings?.map((encoding) => encoding.data).join("") ?? "";
  return pattern.length > 0 ? pattern : null;
}

/** Runs of dark modules, as x offset and width in modules. */
function darkRuns(pattern: string): { x: number; width: number }[] {
  const runs: { x: number; width: number }[] = [];
  let start = -1;

  for (let index = 0; index <= pattern.length; index += 1) {
    const dark = pattern[index] === "1";
    if (dark && start < 0) start = index;
    if (!dark && start >= 0) {
      runs.push({ x: start, width: index - start });
      start = -1;
    }
  }

  return runs;
}

/**
 * A scannable Code 128 barcode, sized in real millimetres.
 *
 * One SVG unit is one module, and a module is a whole number of printer dots
 * (see `fitBarcode`), so every bar edge lands on the head's own grid. The quiet
 * zones are part of the symbol, not decoration: a scanner will not lock on to
 * bars that run up against anything, including the edge of a sticker.
 */
export function Barcode({
  value,
  moduleMm,
  offsetMm,
  barHeight,
  className,
}: {
  value: string;
  /** One module, a whole number of printer dots. */
  moduleMm: number;
  /**
   * Where the left quiet zone starts, from this box's left edge, in whole
   * dots. Omitted, the symbol is simply centred — fine on screen, but on paper
   * centring can put every bar edge half a dot off the head's grid.
   */
  offsetMm?: number;
  /** A CSS length for the bars. Omitted, they fill the height they are given. */
  barHeight?: string;
  className?: string;
}) {
  const pattern = code128Pattern(value);

  if (!pattern) {
    return (
      <p className={cn("font-mono", className)}>{value || "No barcode"}</p>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-white",
        offsetMm === undefined ? "items-center" : "items-start",
        className,
      )}
    >
      <div
        className="flex min-h-0 flex-1 bg-white"
        style={{
          paddingInline: `${QUIET_ZONE_MODULES * moduleMm}mm`,
          marginLeft: offsetMm === undefined ? undefined : `${offsetMm}mm`,
        }}
      >
        <svg
          role="img"
          aria-label={`Barcode ${value}`}
          viewBox={`0 0 ${pattern.length} 1`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          className="block"
          style={{
            width: `${pattern.length * moduleMm}mm`,
            height: barHeight ?? "100%",
          }}
        >
          {darkRuns(pattern).map((run) => (
            <rect key={run.x} x={run.x} y={0} width={run.width} height={1} fill="#000" />
          ))}
        </svg>
      </div>

      {/* The fallback when a label is scuffed: typed in at the till by hand. */}
      <p className="self-stretch text-center font-mono leading-none tracking-wider">
        {value}
      </p>
    </div>
  );
}
