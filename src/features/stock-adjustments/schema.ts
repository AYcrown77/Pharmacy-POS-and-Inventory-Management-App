import { z } from "zod";

import { ADJUSTMENT_REASONS } from "@/lib/status";
import type { AdjustmentReason } from "@/types/domain";

/**
 * Stock adjustment validation.
 *
 * The direction and the magnitude are captured separately — "remove 5" is
 * clearer at a delivery desk than "-5", and it removes any chance of a sign
 * being typed by accident. They are combined into a signed change on submit.
 */
export const adjustStockSchema = z
  .object({
    batchId: z.string().min(1, "Choose the batch being adjusted"),

    direction: z.enum(["INCREASE", "DECREASE"]),

    quantity: z
      .number({ error: "Enter a quantity" })
      .int("Use a whole number of units")
      .positive("Quantity must be greater than zero")
      .max(1_000_000, "That quantity looks too high — check the amount"),

    reason: z.enum(
      ADJUSTMENT_REASONS as unknown as [AdjustmentReason, ...AdjustmentReason[]],
    ),

    notes: z
      .string()
      .trim()
      .max(500, "Notes are too long")
      .transform((value) => (value === "" ? null : value))
      .nullable(),
  })
  .refine(
    // "Other" without an explanation defeats the point of recording a reason.
    (values) => values.reason !== "OTHER" || Boolean(values.notes),
    {
      path: ["notes"],
      error: "Describe the reason when choosing Other",
    },
  );

export type AdjustStockFormValues = z.input<typeof adjustStockSchema>;
