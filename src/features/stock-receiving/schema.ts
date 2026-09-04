import { z } from "zod";

import { today } from "@/lib/date";

/**
 * Stock receiving validation.
 *
 * Prices are entered in naira and converted to kobo at submit. Only genuine
 * errors block the form — a short shelf life or a selling price below cost
 * are surfaced as warnings, because both are legitimate sometimes and the
 * person at the delivery desk is better placed to judge than a rule.
 */
export const receiveStockSchema = z.object({
  productId: z.string().min(1, "Choose the product being received"),

  batchNumber: z
    .string()
    .trim()
    .min(1, "Enter the batch number from the package")
    .max(40, "Batch number is too long"),

  expiryDate: z
    .string()
    .min(1, "Enter the expiry date")
    .refine((value) => value > today(), "The expiry date must be in the future"),

  quantityReceived: z
    .number({ error: "Enter the quantity received" })
    .int("Use a whole number of units")
    .positive("Quantity must be greater than zero")
    .max(1_000_000, "That quantity looks too high — check the amount"),

  costPrice: z
    .number({ error: "Enter the cost price" })
    .nonnegative("Cost price cannot be negative")
    .max(10_000_000, "That price looks too high — check the amount"),

  sellingPrice: z
    .number({ error: "Enter the selling price" })
    .positive("Selling price must be greater than zero")
    .max(10_000_000, "That price looks too high — check the amount"),

  supplierName: z
    .string()
    .trim()
    .min(1, "Enter the supplier")
    .max(120, "Supplier name is too long"),

  receivedAt: z
    .string()
    .min(1, "Enter the date received")
    .refine(
      (value) => value <= today(),
      "The date received cannot be in the future",
    ),
});

export type ReceiveStockFormValues = z.input<typeof receiveStockSchema>;
