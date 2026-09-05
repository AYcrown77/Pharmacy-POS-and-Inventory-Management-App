/**
 * Printing.
 *
 * The page size cannot be chosen with a CSS selector — `@page` sits outside
 * the cascade — so an 80mm receipt gets its rule injected for the duration of
 * the print and removed afterwards. Reports use the paper default declared in
 * `globals.css`.
 */

/** Falls back to the 58mm roll if the stylesheet has not loaded yet. */
const DEFAULT_RECEIPT_PAPER = "58mm";

/**
 * The page is the paper; the content is the narrower printable area.
 *
 * Custom properties do not resolve inside `@page` — it sits outside the
 * cascade — so the width is read from `:root` here and written into the rule.
 * That keeps `--receipt-paper` in `globals.css` the single place to change it.
 */
function receiptPageRule(): string {
  const paper =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--receipt-paper")
      .trim() || DEFAULT_RECEIPT_PAPER;

  return `@page { size: ${paper} auto; margin: 0; }`;
}

function printWithPageRule(rule: string | null) {
  if (typeof window === "undefined") return;

  let style: HTMLStyleElement | null = null;

  if (rule) {
    style = document.createElement("style");
    style.setAttribute("data-print-page-rule", "");
    style.textContent = rule;
    document.head.appendChild(style);
  }

  const cleanUp = () => style?.remove();

  // `window.print()` blocks in some browsers and returns immediately in
  // others, so the rule is removed on `afterprint` rather than on the next
  // line. The timeout is a backstop for browsers that never fire it.
  window.addEventListener("afterprint", cleanUp, { once: true });
  window.setTimeout(cleanUp, 60_000);

  window.print();
}

/** Print the till receipt currently mounted on the page. */
export function printReceipt() {
  printWithPageRule(receiptPageRule());
}

/** Print the report subtree at the paper size configured in the browser. */
export function printReport() {
  printWithPageRule(null);
}

/**
 * Print a strip of product labels.
 *
 * Same roll as the receipt, so the same page rule — the labels are separated
 * by a cut line rather than by page breaks, because the printer feeds a
 * continuous roll and has no notion of a page.
 */
export function printLabels() {
  printWithPageRule(receiptPageRule());
}
