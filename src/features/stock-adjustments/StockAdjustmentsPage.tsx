"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ClipboardList, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  ProductPicker,
  type PickerProduct,
} from "@/components/shared/ProductPicker";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import {
  DataTable,
  EmptyCell,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import {
  FormField,
  FormGrid,
  FormSection,
} from "@/components/ui/FormField";
import { Input, NativeSelect, Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { formatDate, formatDateTime } from "@/lib/date";
import { formatQuantity } from "@/lib/money";
import { productKeys } from "@/lib/query/keys";
import {
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_REASONS,
} from "@/lib/status";
import { productsService } from "@/services/products.service";
import { useProductBatches } from "@/features/products/hooks";
import type { AdjustmentReason, StockAdjustment } from "@/types/domain";
import { adjustStockSchema, type AdjustStockFormValues } from "./schema";
import { useAdjustments, useAdjustStock } from "./hooks";

/**
 * Stock is never edited from 20 to 15 without an explanation (§22).
 *
 * The flow is therefore: pick the batch, state the direction and amount, give
 * a reason, see exactly what will change, then confirm. Every adjustment
 * writes a stock movement and an audit entry.
 */
export function StockAdjustmentsPage() {
  const searchParams = useSearchParams();
  const preselectedBatchId = searchParams.get("batchId");
  const preselectedProductId = searchParams.get("productId");
  const preselectedReason = searchParams.get("reason") as AdjustmentReason | null;

  /**
   * `null` means untouched, so a deep-linked product applies; once the user
   * picks or clears one, their choice wins. Derived rather than synced into
   * state by an effect — see the same note in stock receiving.
   */
  const [selection, setSelection] = useState<{
    product: PickerProduct | null;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const adjust = useAdjustStock();
  const recent = useAdjustments({ pageSize: 10 });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AdjustStockFormValues>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: {
      batchId: "",
      direction: "DECREASE",
      quantity: undefined,
      reason:
        preselectedReason && ADJUSTMENT_REASONS.includes(preselectedReason)
          ? preselectedReason
          : "DAMAGED",
      notes: null,
    },
  });

  // Deep link from the expiry page: pre-fill product, batch and reason.
  const { data: preselectedProduct } = useQuery({
    queryKey: productKeys.detail(preselectedProductId ?? ""),
    queryFn: () => productsService.getById(preselectedProductId!),
    enabled: Boolean(preselectedProductId) && selection === null,
  });

  const product: PickerProduct | null = selection
    ? selection.product
    : (preselectedProduct ?? null);
  const setProduct = (next: PickerProduct | null) =>
    setSelection({ product: next });

  const batches = useProductBatches(product?.id ?? "");

  useEffect(() => {
    if (preselectedBatchId && batches.data?.some((b) => b.id === preselectedBatchId)) {
      setValue("batchId", preselectedBatchId, { shouldValidate: true });
    }
  }, [preselectedBatchId, batches.data, setValue]);

  const values = useWatch({ control });
  const selectedBatch = batches.data?.find(
    (batch) => batch.id === values.batchId,
  );

  const quantity = Number(values.quantity) || 0;
  const signedChange = values.direction === "INCREASE" ? quantity : -quantity;
  const before = selectedBatch?.quantityRemaining ?? 0;
  const after = before + signedChange;
  const wouldGoNegative = after < 0;

  const isDestructive =
    values.direction === "DECREASE" && quantity > 0 && !wouldGoNegative;

  function submit() {
    setConfirming(true);
  }

  async function confirm() {
    const parsed = adjustStockSchema.parse({
      batchId: values.batchId,
      direction: values.direction,
      quantity: values.quantity,
      reason: values.reason,
      notes: values.notes ?? null,
    } as AdjustStockFormValues);

    await adjust.mutateAsync({
      batchId: parsed.batchId,
      adjustment:
        parsed.direction === "INCREASE" ? parsed.quantity : -parsed.quantity,
      reason: parsed.reason,
      notes: parsed.notes,
    });

    setConfirming(false);
    reset({
      batchId: "",
      direction: "DECREASE",
      quantity: undefined,
      reason: "DAMAGED",
      notes: null,
    });
    setProduct(null);
  }

  const columns = useMemo<Column<StockAdjustment>[]>(
    () => [
      {
        id: "createdAt",
        header: "Date",
        width: "15%",
        cell: (row) => (
          <span className="num whitespace-nowrap text-neutral-600">
            {formatDateTime(row.createdAt)}
          </span>
        ),
      },
      {
        id: "product",
        header: "Product",
        width: "21%",
        cell: (row) => (
          <PrimaryCell title={row.productName} subtitle={row.batchNumber} />
        ),
      },
      {
        id: "change",
        header: "Change",
        align: "right",
        width: "12%",
        cell: (row) => (
          <NumericCell
            className={
              row.adjustment > 0 ? "text-success-700" : "text-danger-700"
            }
          >
            {row.adjustment > 0 ? "+" : "−"}
            {formatQuantity(Math.abs(row.adjustment))}
          </NumericCell>
        ),
      },
      {
        id: "after",
        header: "Before → after",
        align: "right",
        width: "12%",
        cell: (row) => (
          <NumericCell muted>
            {formatQuantity(row.quantityBefore)} →{" "}
            <span className="font-medium text-neutral-800">
              {formatQuantity(row.quantityAfter)}
            </span>
          </NumericCell>
        ),
      },
      {
        id: "reason",
        header: "Reason",
        width: "14%",
        cell: (row) => (
          <Badge
            tone={
              row.reason === "EXPIRED" || row.reason === "DAMAGED"
                ? "danger"
                : "warning"
            }
            size="sm"
          >
            {ADJUSTMENT_REASON_LABELS[row.reason]}
          </Badge>
        ),
      },
      {
        id: "notes",
        header: "Notes",
        width: "14%",
        // `truncate` needs a block box to clip against, hence `block`.
        cell: (row) => (
          <span className="block truncate" title={row.notes ?? undefined}>
            {row.notes ?? <EmptyCell />}
          </span>
        ),
      },
      {
        id: "performedBy",
        header: "By",
        width: "12%",
        cell: (row) => row.performedByName,
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Stock adjustments"
        titleHidden
        description="Record damaged, expired, missing or miscounted stock. Every adjustment is written to the stock history and the audit log."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <form onSubmit={handleSubmit(submit)} noValidate>
          <Card>
            <CardBody className="flex flex-col gap-6">
              <FormSection title="What is being adjusted">
                <FormField label="Product" required>
                  {(ids) => (
                    <ProductPicker
                      id={ids.id}
                      value={product}
                      onChange={(next) => {
                        setProduct(next);
                        setValue("batchId", "");
                      }}
                      autoFocus
                    />
                  )}
                </FormField>

                <FormField
                  label="Batch"
                  error={errors.batchId?.message}
                  required
                  hint={
                    product
                      ? "Stock belongs to a batch, so an adjustment must name one."
                      : "Choose a product first."
                  }
                >
                  {(ids) => (
                    <NativeSelect
                      {...ids}
                      {...register("batchId")}
                      disabled={!product || batches.isPending}
                    >
                      <option value="">
                        {product ? "Choose a batch" : "No product selected"}
                      </option>
                      {batches.data?.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.batchNumber} —{" "}
                          {formatQuantity(batch.quantityRemaining)} units, exp{" "}
                          {formatDate(batch.expiryDate)}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              </FormSection>

              <FormSection title="The adjustment">
                <FormGrid columns={3}>
                  <FormField label="Type" required>
                    {(ids) => (
                      <NativeSelect {...ids} {...register("direction")}>
                        <option value="DECREASE">Remove stock</option>
                        <option value="INCREASE">Add stock</option>
                      </NativeSelect>
                    )}
                  </FormField>

                  <FormField
                    label="Quantity"
                    error={errors.quantity?.message}
                    required
                  >
                    {(ids) => (
                      <Input
                        {...ids}
                        {...register("quantity", { valueAsNumber: true })}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        className="num"
                      />
                    )}
                  </FormField>

                  <FormField
                    label="Reason"
                    error={errors.reason?.message}
                    required
                  >
                    {(ids) => (
                      <NativeSelect {...ids} {...register("reason")}>
                        {ADJUSTMENT_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {ADJUSTMENT_REASON_LABELS[reason]}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                </FormGrid>

                <FormField
                  label="Notes"
                  error={errors.notes?.message}
                  hint="Recorded against the adjustment in the audit log."
                >
                  {(ids) => (
                    <Textarea
                      {...ids}
                      {...register("notes")}
                      rows={2}
                      placeholder="e.g. Water damage during storage"
                    />
                  )}
                </FormField>
              </FormSection>

              {wouldGoNegative && selectedBatch && (
                <Alert tone="danger" title="This adjustment is not possible">
                  Batch {selectedBatch.batchNumber} holds{" "}
                  {formatQuantity(before)} units. Removing{" "}
                  {formatQuantity(quantity)} would take it below zero.
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
                disabled={adjust.isPending}
              >
                Clear
              </Button>
              <Button
                type="submit"
                variant={isDestructive ? "danger" : "primary"}
                disabled={wouldGoNegative}
                leadingIcon={<SlidersHorizontal className="size-4" />}
              >
                Review adjustment
              </Button>
            </CardFooter>
          </Card>
        </form>

        <BeforeAfterCard
          batchNumber={selectedBatch?.batchNumber}
          productName={product?.name}
          before={before}
          change={signedChange}
          after={after}
          hasSelection={Boolean(selectedBatch)}
          invalid={wouldGoNegative}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-section font-semibold text-neutral-900">
          Recent adjustments
        </h2>
        <DataTable
          caption="Recent stock adjustments"
          columns={columns}
          rows={recent.data?.data ?? []}
          getRowId={(row) => row.id}
          isLoading={recent.isPending}
          isError={recent.isError}
          onRetry={() => void recent.refetch()}
          density="compact"
          empty={
            <EmptyState
              icon={<ClipboardList className="size-5" />}
              title="No adjustments recorded"
              description="Adjustments you make will be listed here and in the audit log."
            />
          }
        />
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Confirm stock adjustment"
        confirmLabel={signedChange < 0 ? "Remove stock" : "Add stock"}
        confirmVariant={signedChange < 0 ? "danger" : "primary"}
        loading={adjust.isPending}
        onConfirm={() => void confirm()}
        warning="This action will be recorded in the audit history and cannot be undone."
        message={
          <div className="flex flex-col gap-3">
            <p>
              {product?.name} · batch{" "}
              <span className="num font-medium">
                {selectedBatch?.batchNumber}
              </span>
            </p>
            <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2.5 ring-1 ring-inset ring-neutral-200">
              <Figure label="Before" value={formatQuantity(before)} />
              <span className="text-neutral-300" aria-hidden>
                →
              </span>
              <Figure
                label="Change"
                value={`${signedChange > 0 ? "+" : "−"}${formatQuantity(
                  Math.abs(signedChange),
                )}`}
                tone={signedChange > 0 ? "success" : "danger"}
              />
              <span className="text-neutral-300" aria-hidden>
                →
              </span>
              <Figure label="After" value={formatQuantity(after)} emphasis />
            </div>
            <p className="text-meta text-neutral-600">
              Reason:{" "}
              <span className="font-medium text-neutral-800">
                {values.reason
                  ? ADJUSTMENT_REASON_LABELS[values.reason]
                  : "Not set"}
              </span>
              {values.notes ? ` · ${values.notes}` : ""}
            </p>
          </div>
        }
      />
    </PageContainer>
  );
}

/** Before / change / after, the shape the specification asks for. */
function BeforeAfterCard({
  batchNumber,
  productName,
  before,
  change,
  after,
  hasSelection,
  invalid,
}: {
  batchNumber: string | undefined;
  productName: string | undefined;
  before: number;
  change: number;
  after: number;
  hasSelection: boolean;
  invalid: boolean;
}) {
  return (
    <Card className="h-fit">
      <CardHeader title="Effect on stock" />
      <CardBody>
        {!hasSelection ? (
          <p className="py-4 text-center text-base text-neutral-500">
            Choose a batch to preview the change.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="truncate text-base font-medium text-neutral-900">
                {productName}
              </p>
              <p className="num text-meta text-neutral-500">{batchNumber}</p>
            </div>

            <div className="flex flex-col gap-2.5">
              <Line label="Current quantity" value={formatQuantity(before)} />
              <Line
                label="Adjustment"
                value={`${change > 0 ? "+" : change < 0 ? "−" : ""}${formatQuantity(
                  Math.abs(change),
                )}`}
                tone={change > 0 ? "success" : change < 0 ? "danger" : undefined}
              />
              <div className="border-t border-neutral-200 pt-2.5">
                <Line
                  label="New quantity"
                  value={invalid ? "—" : formatQuantity(after)}
                  emphasis
                />
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Line({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-meta text-neutral-500">{label}</span>
      <span
        className={`num ${emphasis ? "text-stat font-semibold" : "text-base font-medium"} ${
          tone === "success"
            ? "text-success-700"
            : tone === "danger"
              ? "text-danger-700"
              : "text-neutral-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  emphasis?: boolean;
}) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="text-micro uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <span
        className={`num font-semibold ${emphasis ? "text-title" : "text-base"} ${
          tone === "success"
            ? "text-success-700"
            : tone === "danger"
              ? "text-danger-700"
              : "text-neutral-900"
        }`}
      >
        {value}
      </span>
    </span>
  );
}

