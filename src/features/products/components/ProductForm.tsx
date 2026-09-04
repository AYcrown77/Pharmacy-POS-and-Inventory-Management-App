"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Save } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import {
  FormField,
  FormGrid,
  FormSection,
} from "@/components/ui/FormField";
import { Input, NativeSelect } from "@/components/ui/Input";
import { koboToNaira, nairaToKobo } from "@/lib/money";
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
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          genericName: product.genericName,
          brandName: product.brandName,
          barcode: product.barcode,
          categoryId: product.categoryId,
          strength: product.strength,
          dosageForm: product.dosageForm ?? "",
          // Prices are stored in kobo; the form works in naira.
          sellingPrice: koboToNaira(product.sellingPrice),
          minimumStockLevel: product.minimumStockLevel,
          unitType: product.unitType,
          isActive: product.isActive,
        }
      : {
          name: "",
          genericName: null,
          brandName: null,
          barcode: null,
          categoryId: "",
          strength: null,
          dosageForm: "",
          sellingPrice: undefined,
          minimumStockLevel: 10,
          unitType: "PACK",
          isActive: true,
        },
  });

  async function submit(values: ProductFormValues) {
    const parsed = productSchema.parse(values);
    await onSubmit({
      ...parsed,
      // Back to integer kobo at the boundary — nothing downstream sees naira.
      sellingPrice: nairaToKobo(parsed.sellingPrice),
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
                hint="Scan into this field, or leave empty for loose items."
              >
                {(ids) => (
                  <Input
                    {...ids}
                    {...register("barcode")}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 6151234567890"
                    className="font-mono"
                  />
                )}
              </FormField>

              <FormField label="Category" error={errors.categoryId?.message} required>
                {(ids) => (
                  <NativeSelect {...ids} {...register("categoryId")}>
                    <option value="">Choose a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </NativeSelect>
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
              <FormField
                label="Selling price"
                error={errors.sellingPrice?.message}
                required
                hint="Price per unit, in naira."
              >
                {(ids) => (
                  <Input
                    {...ids}
                    {...register("sellingPrice", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="0.00"
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
