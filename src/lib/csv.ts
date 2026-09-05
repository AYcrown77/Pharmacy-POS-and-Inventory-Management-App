/**
 * CSV export.
 *
 * The files are opened in Excel, so "clean" means more than comma-separated:
 *
 *   - **Money is exported as a number, not "₦1,234.00".** A column of currency
 *     strings cannot be summed, sorted or charted, which defeats the point of
 *     exporting at all. Kobo are converted to naira with two decimals and no
 *     separators, which Excel reads as numeric.
 *   - **A UTF-8 byte-order mark leads the file.** Without it Excel on Windows
 *     assumes the system codepage and ₦ arrives as mojibake.
 *   - **Dates are ISO.** `2026-09-05` sorts correctly as text and is parsed as
 *     a date by Excel; `05 Sept 2026` does neither.
 *   - **Values that begin with a formula character are neutralised.** Product
 *     names are typed by staff, and a cell starting `=`, `+`, `-` or `@` is
 *     executed by Excel when the file is opened. That is a real attack on
 *     whoever opens the export, not a theoretical one.
 */

import { koboToNaira } from "./money";
import type { Money, Timestamp } from "@/types/common";

/** A cell that should reach the spreadsheet as a number, not text. */
export const csvNumber = (value: number): string =>
  Number.isFinite(value) ? String(value) : "";

/** Kobo to a plain naira decimal Excel can add up. */
export const csvMoney = (kobo: Money): string => koboToNaira(kobo).toFixed(2);

/** An ISO calendar day, which Excel recognises. */
export const csvDate = (value: string | null | undefined): string =>
  value ? value.slice(0, 10) : "";

/** A timestamp as `YYYY-MM-DD HH:MM`, sortable and unambiguous. */
export const csvDateTime = (value: Timestamp | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * A plain number, which must never be quoted as text.
 *
 * Without this the formula guard below catches every negative value — a stock
 * movement of -2, or -12 days until expiry — and prefixes it, so the column
 * lands in Excel as text and can no longer be summed or sorted. Those are
 * exactly the columns someone exports in order to analyse.
 */
const NUMERIC = /^-?\d+(\.\d+)?$/;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  // Neutralise spreadsheet formula injection before quoting, so the guard
  // survives into the file rather than being stripped as whitespace. A real
  // number is exempt; "-2+3" or "=SUM(A1)" is not.
  if (FORMULA_START.test(text) && !NUMERIC.test(text)) text = `'${text}`;

  // Quote whenever the value could otherwise break the row, doubling any
  // quotes it already contains.
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;

  return text;
}

export interface CsvColumn<T> {
  header: string;
  /** Return a already-formatted cell — use the `csv*` helpers for types. */
  value: (row: T) => string | number | null | undefined;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [
    columns.map((column) => escapeCell(column.header)).join(","),
    ...rows.map((row) =>
      columns.map((column) => escapeCell(column.value(row))).join(","),
    ),
  ];
  // CRLF is what Excel expects; it is tolerated everywhere else.
  return lines.join("\r\n");
}

/** `sales-report-2026-09-01-to-2026-09-05.csv` */
export function csvFilename(report: string, range?: { from: string; to: string }) {
  const slug = report
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const period = range ? `-${range.from}-to-${range.to}` : `-${csvDate(new Date().toISOString())}`;
  return `${slug}${period}.csv`;
}

/**
 * Hands the file to the browser.
 *
 * A Blob and an object URL rather than a `data:` URI: Chrome caps data URIs
 * well below the size of a year of sales, and the download would simply fail.
 */
export function downloadCsv(filename: string, csv: string): void {
  // The BOM is what makes Excel read the file as UTF-8.
  const blob = new Blob(["﻿", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Build and download in one call. */
export function exportCsv<T>(
  report: string,
  columns: CsvColumn<T>[],
  rows: readonly T[],
  range?: { from: string; to: string },
): void {
  downloadCsv(csvFilename(report, range), toCsv(columns, rows));
}
