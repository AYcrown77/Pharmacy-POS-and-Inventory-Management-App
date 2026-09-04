import { z } from "zod";

import { DOSAGE_FORMS, UNIT_TYPES } from "@/lib/status";
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

  categoryId: z.string().min(1, "Choose a category"),

  strength: optionalText,

  dosageForm: z
    .union([z.enum(DOSAGE_FORMS as unknown as [DosageForm, ...DosageForm[]]), z.literal("")])
    .transform((value) => (value === "" ? null : (value as DosageForm)))
    .nullable(),

  // Naira, as typed. Converted to kobo before it reaches the service.
  sellingPrice: z
    .number({ error: "Enter a selling price" })
    .positive("The selling price must be greater than zero")
    .max(10_000_000, "That price looks too high — check the amount"),

  minimumStockLevel: z
    .number({ error: "Enter a minimum stock level" })
    .int("Use a whole number of units")
    .min(0, "The minimum cannot be negative")
    .max(100_000, "That minimum looks too high"),

  unitType: z.enum(UNIT_TYPES as unknown as [UnitType, ...UnitType[]]),

  isActive: z.boolean(),
});

export type ProductFormValues = z.input<typeof productSchema>;
export type ProductFormOutput = z.output<typeof productSchema>;
