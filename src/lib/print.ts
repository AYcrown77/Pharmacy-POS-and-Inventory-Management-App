/**
 * Printing.
 *
 * The page size cannot be chosen with a CSS selector — `@page` sits outside
 * the cascade — so an 80mm receipt gets its rule injected for the duration of
 * the print and removed afterwards. Reports use the paper default declared in
 * `globals.css`.
 */

const RECEIPT_PAGE_RULE = "@page { size: 80mm auto; margin: 0; }";

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

/** Print the 80mm receipt currently mounted on the page. */
export function printReceipt() {
  printWithPageRule(RECEIPT_PAGE_RULE);
}

/** Print the report subtree at the paper size configured in the browser. */
export function printReport() {
  printWithPageRule(null);
}
