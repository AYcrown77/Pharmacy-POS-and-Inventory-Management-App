"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, PackagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import {
  ProductPicker,
  type PickerProduct,
} from "@/components/shared/ProductPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import {
  FormField,
  FormGrid,
  FormSection,
} from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { addDays, formatDate, formatExpiryRelative, today } from "@/lib/date";
import {
  formatMoney,
  formatQuantity,
  koboToNaira,
  marginPercent,
  nairaToKobo,
} from "@/lib/money";
import { productKeys } from "@/lib/query/keys";
import { productsService } from "@/services/products.service";
import { useProductBatches } from "@/features/products/hooks";
import { receiveStockSchema, type ReceiveStockFormValues } from "./schema";
import { useReceiveStock, useSuppliers } from "./hooks";

interface ReceivedLine {
  id: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
}

/**
 * A single form rather than a wizard.
 *
 * Receiving is the most repetitive job in the back office — a delivery can be
 * twenty lines — so steps would cost more than they clarify. The three
 * sections keep it legible, and the summary rail shows the effect before the
 * write happens.
 */
export function StockReceivingPage() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("productId");

  /**
   * `null` means the picker is untouched, so the deep-linked product (if any)
   * applies. Once the cashier picks or clears one, their choice wins.
   *
   * Derived rather than copied into state by an effect: syncing fetched data
   * into `useState` causes a cascading render, and leaves two sources of
   * truth to keep in step.
   */
  const [selection, setSelection] = useState<{
    product: PickerProduct | null;
  } | null>(null);
  const [session, setSession] = useState<ReceivedLine[]>([]);

  const receive = useReceiveStock();
  const { data: suppliers } = useSuppliers();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ReceiveStockFormValues>({
    resolver: zodResolver(receiveStockSchema),
    defaultValues: {
      productId: "",
      batchNumber: "",
      expiryDate: "",
      quantityReceived: undefined,
      costPrice: undefined,
      sellingPrice: undefined,
      supplierName: "",
      receivedAt: today(),
    },
  });

  // Deep link from a low-stock alert or a product page.
  const { data: preselected } = useQuery({
    queryKey: productKeys.detail(preselectedId ?? ""),
    queryFn: () => productsService.getById(preselectedId!),
    enabled: Boolean(preselectedId) && selection === null,
  });

  // Annotated: a bare `Product` from the deep-link query is assignable to
  // `PickerProduct`, whose stock fields are optional.
  const product: PickerProduct | null = selection
    ? selection.product
    : (preselected ?? null);
  const setProduct = (next: PickerProduct | null) =>
    setSelection({ product: next });

  const existingBatches = useProductBatches(product?.id ?? "");

  // Mirror the chosen product into the form: the hidden id the schema
  // validates, and the selling price it defaults to.
  useEffect(() => {
    setValue("productId", product?.id ?? "", { shouldValidate: false });
    if (product) {
      setValue("sellingPrice", koboToNaira(product.priceConsumer));
    }
  }, [product, setValue]);

  const values = useWatch({ control });
  const costPrice = Number(values.costPrice) || 0;
  const sellingPrice = Number(values.sellingPrice) || 0;
  const quantity = Number(values.quantityReceived) || 0;
  const expiryDate = values.expiryDate ?? "";

  const margin =
    costPrice > 0 && sellingPrice > 0
      ? marginPercent(nairaToKobo(costPrice), nairaToKobo(sellingPrice))
      : null;

  const duplicateBatch = existingBatches.data?.find(
    (batch) =>
      batch.batchNumber.toLowerCase() ===
      (values.batchNumber ?? "").trim().toLowerCase(),
  );

  const warnings: string[] = [];
  if (expiryDate && expiryDate > today() && expiryDate < addDays(today(), 180)) {
    warnings.push(
      `This batch expires ${formatExpiryRelative(expiryDate).toLowerCase()} — under six months of shelf life.`,
    );
  }
  if (costPrice > 0 && sellingPrice > 0 && sellingPrice < costPrice) {
    warnings.push(
      "The selling price is below the cost price, so this batch would sell at a loss.",
    );
  }
  if (duplicateBatch) {
    warnings.push(
      `Batch ${duplicateBatch.batchNumber} already exists for this product with ${formatQuantity(
        duplicateBatch.quantityRemaining,
      )} units remaining.`,
    );
  }
  if (
    product &&
    sellingPrice > 0 &&
    nairaToKobo(sellingPrice) !== product.priceConsumer
  ) {
    warnings.push(
      `This changes the catalogue selling price from ${formatMoney(
        product.priceConsumer,
      )} to ${formatMoney(nairaToKobo(sellingPrice))}.`,
    );
  }

  async function onSubmit(raw: ReceiveStockFormValues) {
    const parsed = receiveStockSchema.parse(raw);

    const batch = await receive.mutateAsync({
      productId: parsed.productId,
      batchNumber: parsed.batchNumber,
      expiryDate: parsed.expiryDate,
      quantityReceived: parsed.quantityReceived,
      costPrice: nairaToKobo(parsed.costPrice),
      sellingPrice: nairaToKobo(parsed.sellingPrice),
      supplierName: parsed.supplierName,
      receivedAt: parsed.receivedAt,
    });

    setSession((current) => [
      {
        id: batch.id,
        productName: batch.product?.name ?? "Product",
        batchNumber: batch.batchNumber,
        quantity: batch.quantityReceived,
        expiryDate: batch.expiryDate,
      },
      ...current,
    ]);

    // Keep supplier and date so the rest of the delivery can be entered
    // without retyping them; clear everything specific to this line.
    reset({
      productId: "",
      batchNumber: "",
      expiryDate: "",
      quantityReceived: undefined,
      costPrice: undefined,
      sellingPrice: undefined,
      supplierName: parsed.supplierName,
      receivedAt: parsed.receivedAt,
    });
    setProduct(null);
  }

  const currentStock = product?.availableStock ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Stock receiving"
        titleHidden
        description="Record new inventory arriving at the pharmacy. Each delivery line becomes a batch with its own expiry date."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Card>
            <CardBody className="flex flex-col gap-6">
              <FormSection
                title="Product"
                description="What is being received."
              >
                <FormField
                  label="Product"
                  error={errors.productId?.message}
                  required
                >
                  {(ids) => (
                    <ProductPicker
                      id={ids.id}
                      describedBy={ids["aria-describedby"]}
                      invalid={Boolean(errors.productId)}
                      value={product}
                      onChange={setProduct}
                      autoFocus
                    />
                  )}
                </FormField>

                {product && existingBatches.data && existingBatches.data.length > 0 && (
                  <p className="text-meta text-neutral-500">
                    Existing batches:{" "}
                    {existingBatches.data
                      .filter((batch) => batch.quantityRemaining > 0)
                      .map(
                        (batch) =>
                          `${batch.batchNumber} (${formatQuantity(
                            batch.quantityRemaining,
                          )} left, exp ${formatDate(batch.expiryDate)})`,
                      )
                      .join(" · ") || "none with stock remaining"}
                  </p>
                )}
              </FormSection>

              <FormSection
                title="Batch"
                description="Taken from the package or delivery note."
              >
                <FormGrid columns={3}>
                  <FormField
                    label="Batch number"
                    error={errors.batchNumber?.message}
                    required
                  >
                    {(ids) => (
                      <Input
                        {...ids}
                        {...register("batchNumber")}
                        autoComplete="off"
                        placeholder="e.g. PCM003"
                        className="font-mono"
                      />
                    )}
                  </FormField>

                  <FormField
                    label="Expiry date"
                    error={errors.expiryDate?.message}
                    required
                  >
                    {(ids) => (
                      <Input
                        {...ids}
                        {...register("expiryDate")}
                        type="date"
                        min={addDays(today(), 1)}
                      />
                    )}
                  </FormField>

                  <FormField
                    label="Quantity received"
                    error={errors.quantityReceived?.message}
                    required
                    hint={
                      product
                        ? `In ${product.unitType.toLowerCase()}s`
                        : undefined
                    }
                  >
                    {(ids) => (
                      <Input
                        {...ids}
                        {...register("quantityReceived", {
                          valueAsNumber: true,
                        })}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        className="num"
                      />
                    )}
                  </FormField>
                </FormGrid>
              </FormSection>

              <FormSection
                title="Pricing and supply"
                description="Cost is recorded per batch. The selling price updates the catalogue."
              >
                <FormGrid columns={2}>
                  <FormField
                    label="Cost price"
                    error={errors.costPrice?.message}
                    required
                    hint="What the pharmacy paid, per unit."
                  >
                    {(ids) => (
                      <Input
                        {...ids}
                        {...register("costPrice", { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="num"
                      />
                    )}
                  </FormField>

                  <FormField
                    label="Selling price"
                    error={errors.sellingPrice?.message}
                    required
                    hint={
                      margin !== null
                        ? `Margin ${margin.toFixed(1)}%`
                        : "Defaults to the product's current price."
                    }
                  >
                    {(ids) => (
                      <Input
                        {...ids}
                        {...register("sellingPrice", { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="num"
                      />
                    )}
                  </FormField>

                  <FormField
                    label="Supplier"
                    error={errors.supplierName?.message}
                    required
                  >
                    {(ids) => (
                      <>
                        <Input
                          {...ids}
                          {...register("supplierName")}
                          list="supplier-options"
                          autoComplete="off"
                          placeholder="e.g. Emzor Pharmaceuticals"
                        />
                        <datalist id="supplier-options">
                          {suppliers?.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </FormField>

                  <FormField
                    label="Date received"
                    error={errors.receivedAt?.message}
                    required
                  >
                    {(ids) => (
                      <Input
                        {...ids}
                        {...register("receivedAt")}
                        type="date"
                        max={today()}
                      />
                    )}
                  </FormField>
                </FormGrid>

                <Controller
                  control={control}
                  name="productId"
                  render={({ field }) => <input type="hidden" {...field} />}
                />
              </FormSection>

              {warnings.length > 0 && (
                <Alert tone="warning" title="Check before saving">
                  <ul className="ml-4 list-disc space-y-0.5">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </CardBody>

            <CardFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  reset();
                  setProduct(null);
                }}
                disabled={receive.isPending}
              >
                Clear
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={receive.isPending}
                leadingIcon={<PackagePlus className="size-4" />}
              >
                Receive stock
              </Button>
            </CardFooter>
          </Card>
        </form>

        <div className="flex flex-col gap-4">
          <SummaryRail
            product={product}
            currentStock={currentStock}
            quantity={quantity}
            expiryDate={expiryDate}
            costPrice={costPrice}
            batchNumber={values.batchNumber ?? ""}
          />
          <SessionLog lines={session} />
        </div>
      </div>
    </PageContainer>
  );
}

/** Shows the effect of the entry before it is committed. */
function SummaryRail({
  product,
  currentStock,
  quantity,
  expiryDate,
  costPrice,
  batchNumber,
}: {
  product: PickerProduct | null;
  currentStock: number;
  quantity: number;
  expiryDate: string;
  costPrice: number;
  batchNumber: string;
}) {
  return (
    <Card>
      <CardHeader title="This entry" />
      <CardBody>
        {!product ? (
          <p className="py-4 text-center text-base text-neutral-500">
            Choose a product to see the effect on stock.
          </p>
        ) : (
          <dl className="flex flex-col gap-3 text-base">
            <Row label="Product" value={product.name} />
            <Row
              label="Batch"
              value={
                batchNumber ? (
                  <span className="num font-mono">{batchNumber}</span>
                ) : (
                  <span className="text-neutral-300">—</span>
                )
              }
            />
            <Row
              label="Stock after"
              value={
                <span className="num">
                  <span className="text-neutral-500">
                    {formatQuantity(currentStock)}
                  </span>
                  <span className="mx-1.5 text-neutral-400">→</span>
                  <span className="font-semibold text-success-700">
                    {formatQuantity(currentStock + quantity)}
                  </span>
                </span>
              }
            />
            <Row
              label="Expires"
              value={
                expiryDate ? (
                  <span className="flex flex-col items-end">
                    <span className="num">{formatDate(expiryDate)}</span>
                    <span className="text-meta text-neutral-500">
                      {formatExpiryRelative(expiryDate)}
                    </span>
                  </span>
                ) : (
                  <span className="text-neutral-300">—</span>
                )
              }
            />
            <Row
              label="Batch value"
              value={
                <span className="num font-semibold">
                  {formatMoney(nairaToKobo(costPrice) * quantity)}
                </span>
              }
            />
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-meta text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-right text-neutral-900">{value}</dd>
    </div>
  );
}

/** What has been received since the page was opened. */
function SessionLog({ lines }: { lines: ReceivedLine[] }) {
  return (
    <Card>
      <CardHeader
        title="Received in this session"
        actions={
          lines.length > 0 && (
            <Link
              href="/batches"
              className="text-meta font-medium text-primary-700 hover:underline"
            >
              View batches
            </Link>
          )
        }
      />
      {lines.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-5" />}
          title="Nothing received yet"
          description="Entries you save will be listed here."
          className="py-8"
        />
      ) : (
        <div>
          {lines.map((line) => (
            <div
              key={line.id}
              className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-neutral-900">
                  {line.productName}
                </p>
                <p className="num truncate text-meta text-neutral-500">
                  {line.batchNumber} · exp {formatDate(line.expiryDate)}
                </p>
              </div>
              <span className="num shrink-0 font-medium text-success-700">
                +{formatQuantity(line.quantity)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
