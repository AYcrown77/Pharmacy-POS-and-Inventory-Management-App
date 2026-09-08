/**
 * Barcode generation for products that arrive without one.
 *
 * Loose items, repackaged stock and anything a supplier ships unlabelled still
 * need something scannable at the till.
 *
 * **Generated codes start with 2, not 615.** GS1 reserves prefixes 20–29 for
 * restricted circulation — codes used inside one shop and guaranteed never to
 * be issued to a manufacturer. 615 is GS1 Nigeria, a real allocated range: a
 * number invented there could one day collide with an actual product's
 * barcode, and the till would then ring up the wrong medicine. The seeded
 * catalogue uses 615 because those stand in for codes printed by real
 * suppliers; anything this pharmacy mints for itself belongs in the private
 * range.
 *
 * The check digit is computed properly, so the code is a valid EAN-13 even
 * though labels are printed as Code 128 (see `components/shared/Barcode.tsx`
 * for why).
 */

/** The EAN-13 check digit for a 12-digit body. */
export function ean13CheckDigit(body: string): number {
  if (!/^\d{12}$/.test(body)) {
    throw new Error("An EAN-13 check digit needs exactly 12 digits");
  }

  // Positions alternate weight 1 and 3, starting at 1 for the first digit.
  const sum = body
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);

  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  return ean13CheckDigit(value.slice(0, 12)) === Number(value[13 - 1]);
}

/** A random 13-digit code in the in-store range, with a correct check digit. */
export function generateInternalBarcode(): string {
  // "2" marks restricted circulation; the remaining 11 digits are random.
  const body =
    "2" +
    Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");

  return body + ean13CheckDigit(body);
}

/**
 * Generates a code that nothing in the catalogue is already using.
 *
 * `isTaken` is asked the server, because a barcode has to be unique across the
 * whole catalogue and the form only knows about the product in front of it.
 * The server rejects duplicates on save regardless — this exists so the number
 * in the field is already known-good rather than failing at the last step.
 */
export async function generateUniqueBarcode(
  isTaken: (barcode: string) => Promise<boolean>,
  attempts = 5,
): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = generateInternalBarcode();
    if (!(await isTaken(candidate))) return candidate;
  }

  // A collision five times over a 12-digit space means the lookup is lying to
  // us — far more likely than the coincidence. Better to say so than to hand
  // back a number that will be rejected on save.
  throw new Error("Could not generate an unused barcode. Please try again.");
}
