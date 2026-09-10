import { z } from "zod";

import { DOSAGE_FORMS, GROUPING_UNIT_TYPES, UNIT_TYPES } from "@/lib/status";
import type { DosageForm, UnitType } from "@/types/domain";

/**
 * Product form validation.
 *
 * The price is captured in naira (what the pharmacist types) and converted to
 * kobo at the service boundary, so nothing downstream ever sees a float.
 */

/** Trims, then turns an empty string into null — optional text fields. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

/**
 * "One unit of stock is a pack" and "24 in a pack" cannot both be true —
 * stock would be counted in the wrong thing. Shared with the form, which shows
 * it as the two fields are filled in rather than only on save.
 */
export const PACK_BASE_UNIT_MESSAGE =
  "It comes in packs of more than one, so choose what one of them is — such as Tablet or Sachet";

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the product name")
    .max(120, "Product name is too long"),

  genericName: optionalText,
  brandName: optionalText,

  barcode: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine(
      (value) => value === null || /^[0-9]{8,14}$/.test(value),
      "A barcode is 8 to 14 digits",
    ),

  /**
   * The category as typed, not its id. An admin adding a product should not
   * have to leave the form to create a category that does not exist yet, so
   * the field accepts anything and the name is resolved to an id — creating
   * it if needed — when the form is submitted.
   */
  categoryName: z
    .string()
    .trim()
    .min(1, "Choose or type a category")
    .max(80, "Category name is too long"),

  strength: optionalText,

  dosageForm: z
    .union([z.enum(DOSAGE_FORMS as unknown as [DosageForm, ...DosageForm[]]), z.literal("")])
    .transform((value) => (value === "" ? null : (value as DosageForm)))
    .nullable(),

  // Naira, as typed. Converted to kobo before it reaches the service.
  // Three tiers — a distributor, a shop and a walk-in customer — and every
  // one is the price of a single base unit. A pack is never priced on its
  // own: it is always the unit price times the pack size.
  priceWholesale: z
    .number({ error: "Enter a wholesale price" })
    .positive("The wholesale price must be greater than zero")
    .max(10_000_000, "That price looks too high — check the amount"),

  priceRetail: z
    .number({ error: "Enter a retail price" })
    .positive("The retail price must be greater than zero")
    .max(10_000_000, "That price looks too high — check the amount"),

  priceConsumer: z
    .number({ error: "Enter a consumer price" })
    .positive("The consumer price must be greater than zero")
    .max(10_000_000, "That price looks too high — check the amount"),

  /**
   * How many base units make a pack. Turns a pack sale into a stock movement
   * and a unit price into a pack price. 1 for anything only ever sold whole.
   */
  unitsPerPack: z
    .number({ error: "Enter how many units are in a pack" })
    .int("Use a whole number")
    .min(1, "Use 1 for products that are not broken down")
    .max(10_000, "That pack size looks too large"),

  minimumStockLevel: z
    .number({ error: "Enter a minimum stock level" })
    .int("Use a whole number of units")
    .min(0, "The minimum cannot be negative")
    .max(100_000, "That minimum looks too high"),

  unitType: z.enum(UNIT_TYPES as unknown as [UnitType, ...UnitType[]]),

  isActive: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.unitsPerPack > 1 && GROUPING_UNIT_TYPES.includes(value.unitType)) {
    ctx.addIssue({
      code: "custom",
      path: ["unitType"],
      message: PACK_BASE_UNIT_MESSAGE,
    });
  }
});

export type ProductFormValues = z.input<typeof productSchema>;
export type ProductFormOutput = z.output<typeof productSchema>;
