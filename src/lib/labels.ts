/**
 * Label stock, and the geometry that makes a printed barcode scan.
 *
 * A label only scans if two physical facts hold. The page the browser lays out
 * has to be the sticker the printer is loaded with — otherwise the driver
 * shrinks or crops it, slicing off the ends of the barcode along with the white
 * margin a scanner needs. And every bar has to be a whole number of printer
 * dots — otherwise a 203dpi head rounds neighbouring bars to different widths,
 * which Code 128, a symbology built from four bar widths, cannot survive.
 *
 * The setup is remembered per till in `localStorage`: it describes the printer
 * on that counter, not the pharmacy.
 */

export type LabelStock = "STICKER" | "ROLL";

export interface LabelSetup {
  /** Separate die-cut stickers, one per page — or labels end to end on the receipt roll. */
  kind: LabelStock;
  /** One sticker, not counting the gap between stickers. Unused for the roll. */
  widthMm: number;
  heightMm: number;
  /** Thermal heads are almost always 203dpi; some label printers are 300. */
  dpi: 203 | 300;
}

/** Common die-cut sizes, most common first. */
export const STICKER_PRESETS: readonly { widthMm: number; heightMm: number }[] = [
  { widthMm: 50, heightMm: 25 },
  { widthMm: 40, heightMm: 30 },
  { widthMm: 50, heightMm: 30 },
  { widthMm: 38, heightMm: 25 },
  { widthMm: 60, heightMm: 40 },
];

export const STICKER_LIMITS = {
  minWidthMm: 30,
  maxWidthMm: 110,
  minHeightMm: 15,
  maxHeightMm: 150,
} as const;

/** What the head can mark on the 80mm roll — `--receipt-width` in globals.css. */
export const ROLL_PRINTABLE_WIDTH_MM = 72;

export const DEFAULT_LABEL_SETUP: LabelSetup = {
  kind: "STICKER",
  widthMm: 50,
  heightMm: 25,
  dpi: 203,
};

/** Kept clear of the sticker's edges: stock wanders a little under the head. */
export const LABEL_EDGE_MM = 1;

/** Code 128 needs ten modules of white either side before a scanner will lock on. */
export const QUIET_ZONE_MODULES = 10;

const STORAGE_KEY = "mhp.labels.v1";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Half-millimetre steps within the limits; anything unreadable falls back to the default. */
function sizeMm(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? clamp(Math.round(number * 2) / 2, min, max)
    : fallback;
}

/** A usable setup from anything — a half-typed form, or storage written by another build. */
export function normaliseLabelSetup(value: Partial<LabelSetup> | null | undefined): LabelSetup {
  return {
    kind: value?.kind === "ROLL" ? "ROLL" : "STICKER",
    widthMm: sizeMm(
      value?.widthMm,
      STICKER_LIMITS.minWidthMm,
      STICKER_LIMITS.maxWidthMm,
      DEFAULT_LABEL_SETUP.widthMm,
    ),
    heightMm: sizeMm(
      value?.heightMm,
      STICKER_LIMITS.minHeightMm,
      STICKER_LIMITS.maxHeightMm,
      DEFAULT_LABEL_SETUP.heightMm,
    ),
    dpi: value?.dpi === 300 ? 300 : 203,
  };
}

export function loadLabelSetup(): LabelSetup {
  if (typeof window === "undefined") return DEFAULT_LABEL_SETUP;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw
      ? normaliseLabelSetup(JSON.parse(raw) as Partial<LabelSetup>)
      : DEFAULT_LABEL_SETUP;
  } catch {
    return DEFAULT_LABEL_SETUP;
  }
}

export function saveLabelSetup(setup: LabelSetup) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch {
    // Storage blocked. The setup still applies to this print; it just will not
    // be remembered for the next one.
  }
}

/** A length rounded to whole printer dots. */
export function toWholeDotsMm(mm: number, dpi: number): number {
  const dotMm = 25.4 / dpi;
  return Math.round(mm / dotMm) * dotMm;
}

export interface BarcodeFit {
  /** Printer dots in one module — the narrowest bar. */
  dots: number;
  /** The same module in millimetres. */
  moduleMm: number;
  /** The whole symbol, both quiet zones included. */
  widthMm: number;
  /** False when even the narrowest reliable bars run past the label. */
  fits: boolean;
  /** From the label's content edge to the left quiet zone, in whole dots. */
  offsetMm: number;
}

/**
 * The widest whole-dot module that fits the label, and where to put it.
 *
 * Below about 0.25mm a thermal head starts merging bars; above about 0.5mm the
 * symbol only gets longer. Whole dots matter more than either bound — and not
 * only for the width of each bar but for where the symbol starts. Centred by
 * the browser, it can begin half a dot in, and then every bar edge sits on the
 * boundary between two dots and rounds whichever way it likes. So the symbol
 * is placed a whole number of dots in from the label edge, which is itself a
 * whole number of dots in from the edge of the page.
 */
export function fitBarcode(modules: number, labelWidthMm: number, dpi: number): BarcodeFit {
  const dotMm = 25.4 / dpi;
  const edgeDots = Math.round(LABEL_EDGE_MM / dotMm);
  const contentDots = Math.floor(labelWidthMm / dotMm) - 2 * edgeDots;
  const totalModules = modules + 2 * QUIET_ZONE_MODULES;

  const minDots = Math.ceil(0.245 / dotMm);
  const maxDots = Math.max(minDots, Math.floor(0.51 / dotMm));
  const dots = clamp(Math.floor(contentDots / totalModules), minDots, maxDots);
  const symbolDots = totalModules * dots;

  return {
    dots,
    moduleMm: dots * dotMm,
    widthMm: symbolDots * dotMm,
    fits: totalModules * minDots <= contentDots,
    offsetMm: Math.max(0, Math.floor((contentDots - symbolDots) / 2)) * dotMm,
  };
}
