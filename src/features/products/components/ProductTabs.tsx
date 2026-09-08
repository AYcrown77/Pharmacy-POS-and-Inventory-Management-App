"use client";

import Link from "next/link";
import { Boxes, PackagePlus, Receipt, Warehouse } from "lucide-react";

import {
  MovementTypeBadge,
  PaymentMethodBadge,
  QuantityDelta,
  StockStatusBadge,
} from "@/components/shared/StatusBadges";
import { ExpiryStatusBadge } from "@/components/shared/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  DataTable,
  EmptyCell,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/States";
import { Can } from "@/lib/auth/AuthProvider";
import {
  formatDate,
  formatDateTime,
  formatExpiryRelative,
} from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import {
  deriveStockStatus,
  DOSAGE_FORM_LABELS,
  UNIT_TYPE_LABELS,
} from "@/lib/status";
import type { Batch, Product, Sale, StockMovement } from "@/types/domain";

/* -------------------------------------------------------------------------
   Overview
   ------------------------------------------------------------------------- */

export function ProductOverviewTab({
  product,
  batches,
}: {
  product: Product;
  batches: Batch[] | undefined;
}) {
  const sellable = (batches ?? []).filter(
    (batch) => batch.quantityRemaining > 0 && batch.daysUntilExpiry >= 0,
  );
  const available = sellable.reduce(
    (total, batch) => total + batch.quantityRemaining,
    0,
  );
  const stockValue = sellable.reduce(
    (total, batch) => total + batch.quantityRemaining * batch.costPrice,
    0,
  );
  const nearest = sellable[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          size="sm"
          label="Available stock"
          value={formatQuantity(available)}
          context={`Minimum ${formatQuantity(product.minimumStockLevel)} ${UNIT_TYPE_LABELS[
            product.unitType
          ].toLowerCase()}s`}
          tone="warning"
          accent={available <= product.minimumStockLevel}
        />
        <StatCard
          size="sm"
          label="Selling price"
          value={formatMoney(product.priceConsumer)}
          context={`Per ${UNIT_TYPE_LABELS[product.unitType].toLowerCase()}`}
        />
        <StatCard
          size="sm"
          label="Stock value"
          value={formatMoney(stockValue)}
          context="At cost price"
        />
        <StatCard
          size="sm"
          label="Nearest expiry"
          value={nearest ? formatDate(nearest.expiryDate) : "—"}
          context={
            nearest
              ? formatExpiryRelative(nearest.expiryDate)
              : "No sellable batches"
          }
          tone="danger"
          accent={Boolean(nearest && nearest.daysUntilExpiry <= 30)}
        />
      </div>

      <Card>
        <CardHeader title="Product information" />
        <CardBody>
          <DescriptionList
            columns={3}
            items={[
              { label: "Product name", value: product.name },
              { label: "Generic name", value: product.genericName },
              { label: "Brand", value: product.brandName },
              { label: "Category", value: product.category?.name },
              { label: "Strength", value: product.strength },
              {
                label: "Dosage form",
                value: product.dosageForm
                  ? DOSAGE_FORM_LABELS[product.dosageForm]
                  : null,
              },
              {
                label: "Unit type",
                value: UNIT_TYPE_LABELS[product.unitType],
              },
              {
                label: "Barcode",
                value: product.barcode ? (
                  <span className="num font-mono">{product.barcode}</span>
                ) : null,
              },
              {
                label: "Inventory status",
                value: (
                  <StockStatusBadge
                    status={deriveStockStatus(
                      available,
                      product.minimumStockLevel,
                    )}
                    size="sm"
                  />
                ),
              },
              {
                label: "Catalogue status",
                value: (
                  <Badge tone={product.isActive ? "success" : "neutral"} size="sm">
                    {product.isActive ? "Active" : "Inactive"}
                  </Badge>
                ),
              },
              { label: "Created", value: formatDateTime(product.createdAt) },
              { label: "Last updated", value: formatDateTime(product.updatedAt) },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Batches
   ------------------------------------------------------------------------- */

const batchColumns: Column<Batch>[] = [
  {
    id: "batchNumber",
    header: "Batch",
    cell: (batch) => (
      <PrimaryCell
        title={<span className="num font-mono">{batch.batchNumber}</span>}
        subtitle={batch.supplierName ?? undefined}
      />
    ),
  },
  {
    id: "expiryDate",
    header: "Expiry",
    cell: (batch) => (
      <div className="flex flex-col">
        <span className="num">{formatDate(batch.expiryDate)}</span>
        <span className="text-meta text-neutral-500">
          {formatExpiryRelative(batch.expiryDate)}
        </span>
      </div>
    ),
  },
  {
    id: "quantityRemaining",
    header: "Remaining",
    align: "right",
    cell: (batch) => (
      <NumericCell muted={batch.quantityRemaining === 0}>
        {formatQuantity(batch.quantityRemaining)}
        <span className="text-neutral-400">
          {" / "}
          {formatQuantity(batch.quantityReceived)}
        </span>
      </NumericCell>
    ),
  },
  {
    id: "costPrice",
    header: "Cost",
    align: "right",
    cell: (batch) => (
      <NumericCell muted>{formatMoney(batch.costPrice)}</NumericCell>
    ),
  },
  {
    id: "sellingPrice",
    header: "Selling",
    align: "right",
    cell: (batch) => <NumericCell>{formatMoney(batch.sellingPrice)}</NumericCell>,
  },
  {
    id: "receivedAt",
    header: "Received",
    cell: (batch) => (
      <span className="num text-neutral-600">
        {formatDate(batch.receivedAt.slice(0, 10))}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: (batch) => <ExpiryStatusBadge status={batch.expiryStatus} size="sm" />,
  },
];

export function ProductBatchesTab({
  productId,
  batches,
  isPending,
  isError,
  onRetry,
}: {
  productId: string;
  batches: Batch[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  // Earliest expiry with stock left is the one FEFO will draw from next.
  const nextForSale = batches?.find(
    (batch) => batch.quantityRemaining > 0 && batch.daysUntilExpiry >= 0,
  );

  const columns: Column<Batch>[] = [
    {
      ...batchColumns[0],
      cell: (batch) => (
        <div className="flex min-w-0 items-center gap-2">
          <PrimaryCell
            title={<span className="num font-mono">{batch.batchNumber}</span>}
            subtitle={batch.supplierName ?? undefined}
          />
          {batch.id === nextForSale?.id && (
            <Badge tone="primary" size="sm">
              Next for sale
            </Badge>
          )}
        </div>
      ),
    },
    ...batchColumns.slice(1),
  ];

  return (
    <div className="flex flex-col gap-3">
      {nextForSale && (
        <p className="text-meta text-neutral-500">
          Stock is drawn earliest-expiry-first. The next sale of this product is
          expected to come from batch{" "}
          <span className="num font-medium text-neutral-700">
            {nextForSale.batchNumber}
          </span>
          . The server decides the final allocation at the moment of sale.
        </p>
      )}

      <DataTable
        caption="Batches of this product"
        columns={columns}
        rows={batches ?? []}
        getRowId={(batch) => batch.id}
        isLoading={isPending}
        isError={isError}
        onRetry={onRetry}
        density="compact"
        rowClassName={(batch) =>
          batch.quantityRemaining === 0 ? "opacity-55" : undefined
        }
        empty={
          <EmptyState
            icon={<Boxes className="size-5" />}
            title="No batches recorded"
            description="This product has no stock. Receive a batch to make it sellable."
            action={
              <Can permission="stock:receive">
                <Button
                  asChild
                  variant="primary"
                  leadingIcon={<PackagePlus className="size-4" />}
                >
                  <Link href={`/stock/receive?productId=${productId}`}>
                    Receive stock
                  </Link>
                </Button>
              </Can>
            }
          />
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
   Stock movements
   ------------------------------------------------------------------------- */

const movementColumns: Column<StockMovement>[] = [
  {
    id: "createdAt",
    header: "Date",
    width: "18%",
    cell: (movement) => (
      <span className="num whitespace-nowrap text-neutral-600">
        {formatDateTime(movement.createdAt)}
      </span>
    ),
  },
  {
    id: "movementType",
    header: "Type",
    cell: (movement) => <MovementTypeBadge type={movement.movementType} size="sm" />,
  },
  {
    id: "batchNumber",
    header: "Batch",
    cell: (movement) =>
      movement.batchNumber ? (
        <span className="num font-mono text-sm text-neutral-600">
          {movement.batchNumber}
        </span>
      ) : (
        <EmptyCell />
      ),
  },
  {
    id: "quantity",
    header: "Change",
    align: "right",
    cell: (movement) => (
      <QuantityDelta
        value={movement.quantity}
        tone={movement.movementType === "SALE" ? "neutral" : "auto"}
      />
    ),
  },
  {
    id: "newQuantity",
    header: "Batch after",
    align: "right",
    cell: (movement) => (
      <NumericCell muted>
        {formatQuantity(movement.previousQuantity)} →{" "}
        <span className="font-medium text-neutral-800">
          {formatQuantity(movement.newQuantity)}
        </span>
      </NumericCell>
    ),
  },
  {
    id: "userName",
    header: "By",
    cell: (movement) => movement.userName,
  },
  {
    id: "reason",
    header: "Reason",
    cell: (movement) => movement.reason ?? <EmptyCell />,
  },
];

export function ProductMovementsTab({
  movements,
  isPending,
  isError,
  onRetry,
}: {
  movements: StockMovement[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <DataTable
      caption="Stock movements for this product"
      columns={movementColumns}
      rows={movements ?? []}
      getRowId={(movement) => movement.id}
      isLoading={isPending}
      isError={isError}
      onRetry={onRetry}
      density="compact"
      empty={
        <EmptyState
          icon={<Warehouse className="size-5" />}
          title="No stock movements"
          description="Receiving, sales and adjustments for this product appear here."
        />
      }
    />
  );
}

/* -------------------------------------------------------------------------
   Sales history
   ------------------------------------------------------------------------- */

export function ProductSalesTab({
  productId,
  sales,
  isPending,
  isError,
  onRetry,
}: {
  productId: string;
  sales: Sale[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const columns: Column<Sale>[] = [
    {
      id: "receiptNumber",
      header: "Receipt",
      cell: (sale) => (
        <span className="num font-medium text-neutral-900">
          {sale.receiptNumber}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Date",
      cell: (sale) => (
        <span className="num whitespace-nowrap text-neutral-600">
          {formatDateTime(sale.createdAt)}
        </span>
      ),
    },
    {
      id: "quantity",
      header: "Qty sold",
      align: "right",
      cell: (sale) => (
        <NumericCell>
          {formatQuantity(
            sale.items
              .filter((item) => item.productId === productId)
              .reduce((total, item) => total + item.quantity, 0),
          )}
        </NumericCell>
      ),
    },
    {
      id: "batch",
      header: "From batch",
      cell: (sale) => (
        <span className="num font-mono text-sm text-neutral-600">
          {sale.items
            .filter((item) => item.productId === productId)
            .map((item) => item.batchNumber)
            .join(", ")}
        </span>
      ),
    },
    {
      id: "cashierName",
      header: "Cashier",
      cell: (sale) => sale.cashierName,
    },
    {
      id: "paymentMethod",
      header: "Payment",
      cell: (sale) => <PaymentMethodBadge method={sale.paymentMethod} size="sm" />,
    },
    {
      id: "lineTotal",
      header: "Line total",
      align: "right",
      cell: (sale) => (
        <NumericCell>
          {formatMoney(
            sale.items
              .filter((item) => item.productId === productId)
              .reduce((total, item) => total + item.subtotal, 0),
          )}
        </NumericCell>
      ),
    },
  ];

  return (
    <DataTable
      caption="Sales containing this product"
      columns={columns}
      rows={sales ?? []}
      getRowId={(sale) => sale.id}
      isLoading={isPending}
      isError={isError}
      onRetry={onRetry}
      density="compact"
      empty={
        <EmptyState
          icon={<Receipt className="size-5" />}
          title="Not sold yet"
          description="Sales containing this product will be listed here."
        />
      }
    />
  );
}
