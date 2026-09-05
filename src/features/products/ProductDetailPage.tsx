"use client";

import Link from "next/link";
import { PackagePlus, Pencil, Tag } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { Can } from "@/lib/auth/AuthProvider";
import { PrintLabelDialog } from "./components/PrintLabelDialog";
import {
  ProductBatchesTab,
  ProductMovementsTab,
  ProductOverviewTab,
  ProductSalesTab,
} from "./components/ProductTabs";
import {
  useProduct,
  useProductBatches,
  useProductMovements,
  useProductSales,
} from "./hooks";

type TabValue = "overview" | "batches" | "movements" | "sales";

export function ProductDetailPage({ productId }: { productId: string }) {
  const [tab, setTab] = useState<TabValue>("overview");
  const [labelsOpen, setLabelsOpen] = useState(false);

  const product = useProduct(productId);
  const batches = useProductBatches(productId);
  const movements = useProductMovements(productId);
  const sales = useProductSales(productId);

  if (product.isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Could not load this product"
          description="It may have been removed, or the server did not respond."
          onRetry={() => void product.refetch()}
        />
      </PageContainer>
    );
  }

  if (product.isPending) {
    return (
      <PageContainer>
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-96" />
      </PageContainer>
    );
  }

  const { data } = product;

  return (
    <PageContainer>
      <PageHeader
        title={data.name}
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: data.name },
        ]}
        description={
          [data.genericName, data.strength, data.category?.name]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <>
            {!data.isActive && <Badge tone="neutral">Inactive</Badge>}
            <Button
              variant="secondary"
              leadingIcon={<Tag className="size-4" />}
              onClick={() => setLabelsOpen(true)}
            >
              Print label
            </Button>
            <Can permission="stock:receive">
              <Button
                asChild
                variant="secondary"
                leadingIcon={<PackagePlus className="size-4" />}
              >
                <Link href={`/stock/receive?productId=${productId}`}>
                  Receive stock
                </Link>
              </Button>
            </Can>
            <Can permission="products:write">
              <Button
                asChild
                variant="primary"
                leadingIcon={<Pencil className="size-4" />}
              >
                <Link href={`/products/${productId}/edit`}>Edit</Link>
              </Button>
            </Can>
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as TabValue)}
        tabs={[
          { value: "overview", label: "Overview" },
          {
            value: "batches",
            label: "Batches",
            badge: batches.data?.length,
          },
          {
            value: "movements",
            label: "Stock movement",
            badge: movements.data?.total,
          },
          {
            value: "sales",
            label: "Sales history",
            badge: sales.data?.total,
          },
        ]}
      >
        <TabPanel value="overview">
          <ProductOverviewTab product={data} batches={batches.data} />
        </TabPanel>

        <TabPanel value="batches">
          <ProductBatchesTab
            productId={productId}
            batches={batches.data}
            isPending={batches.isPending}
            isError={batches.isError}
            onRetry={() => void batches.refetch()}
          />
        </TabPanel>

        <TabPanel value="movements">
          <ProductMovementsTab
            movements={movements.data?.data}
            isPending={movements.isPending}
            isError={movements.isError}
            onRetry={() => void movements.refetch()}
          />
        </TabPanel>

        <TabPanel value="sales">
          <ProductSalesTab
            productId={productId}
            sales={sales.data?.data}
            isPending={sales.isPending}
            isError={sales.isError}
            onRetry={() => void sales.refetch()}
          />
        </TabPanel>
      </Tabs>

      <PrintLabelDialog
        product={data}
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
      />
    </PageContainer>
  );
}
