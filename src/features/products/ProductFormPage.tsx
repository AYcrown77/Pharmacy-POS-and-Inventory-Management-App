"use client";

import { useRouter } from "next/navigation";

import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import type { ProductInput } from "@/services/products.service";
import { ProductForm } from "./components/ProductForm";
import {
  useCategories,
  useCreateProduct,
  useProduct,
  useUpdateProduct,
} from "./hooks";

export function NewProductPage() {
  const router = useRouter();
  const categories = useCategories();
  const create = useCreateProduct();

  async function handleSubmit(input: ProductInput) {
    const product = await create.mutateAsync(input);
    router.push(`/products/${product.id}`);
  }

  return (
    <PageContainer>
      <PageHeader
        title="New product"
        titleHidden
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: "New product" },
        ]}
        description="Add a medicine to the catalogue. Stock is added separately through stock receiving."
      />

      {categories.isError ? (
        <ErrorState onRetry={() => void categories.refetch()} />
      ) : categories.isPending ? (
        <SkeletonCard className="h-96" />
      ) : (
        <ProductForm
          categories={categories.data}
          isSubmitting={create.isPending}
          onSubmit={handleSubmit}
        />
      )}
    </PageContainer>
  );
}

export function EditProductPage({ productId }: { productId: string }) {
  const router = useRouter();
  const product = useProduct(productId);
  const categories = useCategories();
  const update = useUpdateProduct(productId);

  async function handleSubmit(input: ProductInput) {
    await update.mutateAsync(input);
    router.push(`/products/${productId}`);
  }

  const isLoading = product.isPending || categories.isPending;
  const isError = product.isError || categories.isError;

  return (
    <PageContainer>
      <PageHeader
        title={product.data ? `Edit ${product.data.name}` : "Edit product"}
        breadcrumbs={[
          { label: "Products", href: "/products" },
          ...(product.data
            ? [
                {
                  label: product.data.name,
                  href: `/products/${productId}`,
                },
              ]
            : []),
          { label: "Edit" },
        ]}
      />

      {isError ? (
        <ErrorState
          title="Could not load this product"
          onRetry={() => {
            void product.refetch();
            void categories.refetch();
          }}
        />
      ) : isLoading || !product.data || !categories.data ? (
        <SkeletonCard className="h-96" />
      ) : (
        <ProductForm
          product={product.data}
          categories={categories.data}
          isSubmitting={update.isPending}
          onSubmit={handleSubmit}
        />
      )}
    </PageContainer>
  );
}
