"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useState } from "react";
import { Save, ScanLine, Sparkles } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import {
  FormField,
  FormGrid,
  FormSection,
} from "@/components/ui/FormField";
import { Input, NativeSelect } from "@/components/ui/Input";
import { generateUniqueBarcode } from "@/lib/barcode";
import { koboToNaira, nairaToKobo } from "@/lib/money";
import { productsService } from "@/services/products.service";
import {
  DOSAGE_FORM_LABELS,
  DOSAGE_FORMS,
  UNIT_TYPE_LABELS,
  UNIT_TYPES,
} from "@/lib/status";
import type { ProductInput } from "@/services/products.service";
import type { Category, Product } from "@/types/domain";
import { productSchema, type ProductFormValues } from "../schema";

/**
 * One form for creating and editing.
 *
 * Fields are grouped into three short sections rather than run into a single
 * long column — an administrator adding a product should be able to see the
 * whole shape of the record at once.
 */
export function ProductForm({
  product,
  categories,
  isSubmitting,
  onSubmit,
}: {
  product?: Product;
  categories: Category[];
  isSubmitting: boolean;
  onSubmit: (input: ProductInput) => Promise<unknown>;
}) {
  const router = useRouter();
  const isEditing = Boolean(product);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setFocus,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          genericName: product.genericName,
          brandName: product.brandName,
          barcode: product.barcode,
          categoryName: product.category?.name ?? "",
          strength: product.strength,
          dosageForm: product.dosageForm ?? "",
          // Prices are stored in kobo; the form works in naira.
          priceWholesale: koboToNaira(product.priceWholesale),
          priceRetail: koboToNaira(product.priceRetail),
          priceConsumer: koboToNaira(product.priceConsumer),
          unitsPerPack: product.unitsPerPack,
          minimumStockLevel: product.minimumStockLevel,
          unitType: product.unitType,
          isActive: product.isActive,
        }
      : {
          name: "",
          genericName: null,
          brandName: null,
          barcode: null,
          categoryName: "",
          strength: null,
          dosageForm: "",
          priceWholesale: undefined,
          priceRetail: undefined,
          priceConsumer: undefined,
          unitsPerPack: 1,
          minimumStockLevel: 10,
          unitType: "PACK",
          isActive: true,
        },
  });

  const [generating, setGenerating] = useState(false);

  /**
   * Mints a code for a product that has none.
   *
   * Uniqueness is checked against the catalogue as it goes, so the number that
   * lands in the field is already free. The server still rejects duplicates on
   * save — this only saves the admin from being told so after filling in the
   * rest of the form.
   */
  async function generateBarcode() {
    setGenerating(true);
    clearErrors("barcode");
    try {
      const barcode = await generateUniqueBarcode(async (candidate) =>
        Boolean(await productsService.getByBarcode(candidate)),
      );
      setValue("barcode", barcode, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      setError("barcode", {
        message:
          error instanceof Error
            ? error.message
            : "Could not generate a barcode.",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function submit(values: ProductFormValues) {
    const parsed = productSchema.parse(values);

    // The API stores a category id; the form collects a name. An exact match
    // (case-insensitive) reuses the existing category rather than creating a
    // near-duplicate — "Antibiotics" and "antibiotics" must not become two.
    const typed = parsed.categoryName.trim();
    const existing = categories.find(
      (category) => category.name.toLowerCase() === typed.toLowerCase(),
    );

    let categoryId = existing?.id;
    if (!categoryId) {
      const created = await productsService.createCategory(typed);
      categoryId = created.id;
    }

    // Spelled out rather than spread: the form carries a category *name*
    // that the API has no field for, and listing the payload keeps that
    // boundary visible instead of relying on a rest-spread to drop it.
    await onSubmit({
      name: parsed.name,
      genericName: parsed.genericName,
      brandName: parsed.brandName,
      barcode: parsed.barcode,
      categoryId,
      strength: parsed.strength,
      dosageForm: parsed.dosageForm,
      // Back to integer kobo at the boundary — nothing downstream sees naira.
      priceWholesale: nairaToKobo(parsed.priceWholesale),
      priceRetail: nairaToKobo(parsed.priceRetail),
      priceConsumer: nairaToKobo(parsed.priceConsumer),
      unitsPerPack: parsed.unitsPerPack,
      minimumStockLevel: parsed.minimumStockLevel,
      unitType: parsed.unitType,
      isActive: parsed.isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <Card>
        <CardBody className="flex flex-col gap-6">
          <FormSection
            title="Identification"
            description="How staff will find this medicine when searching or scanning."
          >
            <FormGrid columns={2}>
              <FormField
                label="Product name"
                error={errors.name?.message}
                required
                hint="Include the strength, e.g. Paracetamol 500mg"
                className="sm:col-span-2"
              >
                {(ids) => (
                  <Input
                    {...ids}
                    {...register("name")}
                    autoFocus
                    placeholder="e.g. Paracetamol 500mg"
                  />
                )}
              </FormField>

              <FormField label="Generic name" error={errors.genericName?.message}>
                {(ids) => (
                  <Input
                    {...ids}
                    {...register("genericName")}
                    placeholder="e.g. Paracetamol"
                  />
                )}
              </FormField>

              <FormField label="Brand name" error={errors.brandName?.message}>
                {(ids) => (
                  <Input
                    {...ids}
                    {...register("brandName")}
                    placeholder="e.g. Emzor"
                  />
                )}
              </FormField>

              <FormField
                label="Barcode"
                error={errors.barcode?.message}
                hint="Scan the pack, or generate a code for an item that has none."
              >
                {(ids) => (
                  <div className="flex items-start gap-2">
                    <Input
                      {...ids}
                      {...register("barcode")}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="e.g. 6151234567890"
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      // Focusing the field is the whole of "scan": a scanner is
                      // a keyboard, so it types into whatever has focus.
                      onClick={() => setFocus("barcode")}
                      leadingIcon={<ScanLine className="size-4" />}
                      className="shrink-0"
                    >
                      Scan
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      loading={generating}
                      onClick={() => void generateBarcode()}
                      leadingIcon={<Sparkles className="size-4" />}
                      className="shrink-0"
                    >
                      Generate
                    </Button>
                  </div>
                )}
              </FormField>

              <FormField
                label="Category"
                error={errors.categoryName?.message}
                required
                hint="Pick one, or type a new category to create it."
              >
                {(ids) => (
                  <>
                    <Input
                      {...ids}
                      {...register("categoryName")}
                      list="product-category-options"
                      autoComplete="off"
                      placeholder="e.g. Antibiotics"
                    />
                    {/* A datalist keeps the field a plain text input — it
                        suggests without constraining, which is what lets a
                        new category be typed straight in. */}
                    <datalist id="product-category-options">
                      {categories.map((category) => (
                        <option key={category.id} value={category.name} />
                      ))}
                    </datalist>
                  </>
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Presentation"
            description="How the medicine is supplied and sold."
          >
            <FormGrid columns={3}>
              <FormField label="Strength" error={errors.strength?.message}>
                {(ids) => (
                  <Input {...ids} {...register("strength")} placeholder="e.g. 500mg" />
                )}
              </FormField>

              <FormField label="Dosage form" error={errors.dosageForm?.message}>
                {(ids) => (
                  <NativeSelect {...ids} {...register("dosageForm")}>
                    <option value="">Not specified</option>
                    {DOSAGE_FORMS.map((form) => (
                      <option key={form} value={form}>
                        {DOSAGE_FORM_LABELS[form]}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>

              <FormField
                label="Unit type"
                error={errors.unitType?.message}
                required
                hint="What one unit of stock represents."
              >
                {(ids) => (
                  <NativeSelect {...ids} {...register("unitType")}>
                    {UNIT_TYPES.map((unit) => (
                      <option key={unit} value={unit}>
                        {UNIT_TYPE_LABELS[unit]}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Pricing and stock control"
            description="Cost price and quantity are recorded per batch when stock is received."
          >
            <FormGrid columns={3}>
              {/* Three prices for the same pack. Consumer is the walk-in
                  price and the one the till starts on; the other two are what
                  trade buyers pay. */}
              {(
                [
                  ["priceWholesale", "Wholesale price (per pack)", "Distributors and bulk buyers."],
                  ["priceRetail", "Retail price (per pack)", "Shops buying to resell."],
                  ["priceConsumer", "Consumer price (each)", "Walk-in customers. Charged per single unit."],
                ] as const
              ).map(([field, label, hint]) => (
                <FormField
                  key={field}
                  label={label}
                  error={errors[field]?.message}
                  required
                  hint={hint}
                >
                  {(ids) => (
                    <Input
                      {...ids}
                      {...register(field, { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="num"
                    />
                  )}
                </FormField>
              ))}

              <FormField
                label="Units per pack"
                error={errors.unitsPerPack?.message}
                required
                hint="How many singles are in a pack. Use 1 if it is sold whole."
              >
                {(ids) => (
                  <Input
                    {...ids}
                    {...register("unitsPerPack", { valueAsNumber: true })}
                    type="number"
                    step="1"
                    min="1"
                    inputMode="numeric"
                    className="num"
                  />
                )}
              </FormField>

              <FormField
                label="Minimum stock level"
                error={errors.minimumStockLevel?.message}
                required
                hint="Triggers the low-stock alert."
              >
                {(ids) => (
                  <Input
                    {...ids}
                    {...register("minimumStockLevel", { valueAsNumber: true })}
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    className="num"
                  />
                )}
              </FormField>

              <FormField
                label="Status"
                error={errors.isActive?.message}
                hint="Inactive products cannot be sold."
              >
                {(ids) => (
                  <Controller
                    control={control}
                    name="isActive"
                    render={({ field }) => (
                      <NativeSelect
                        {...ids}
                        value={field.value ? "active" : "inactive"}
                        onChange={(event) =>
                          field.onChange(event.target.value === "active")
                        }
                        onBlur={field.onBlur}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </NativeSelect>
                    )}
                  />
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          {isEditing && isDirty && (
            <Alert tone="info">
              Changing the selling price affects future sales only. Receipts
              already issued keep the price charged at the time.
            </Alert>
          )}
        </CardBody>

        <CardFooter>
          <Button
            variant="secondary"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            leadingIcon={<Save className="size-4" />}
          >
            {isEditing ? "Save changes" : "Create product"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
