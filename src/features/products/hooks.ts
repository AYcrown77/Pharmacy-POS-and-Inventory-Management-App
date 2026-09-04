"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";

import { useToast } from "@/components/ui/Toast";
import { toErrorMessage } from "@/lib/api/http";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  auditKeys,
  batchKeys,
  inventoryKeys,
  movementKeys,
  productKeys,
  salesKeys,
} from "@/lib/query/keys";
import { inventoryService } from "@/services/inventory.service";
import {
  productsService,
  type ProductFilters,
  type ProductInput,
} from "@/services/products.service";
import { salesService } from "@/services/sales.service";

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => productsService.list(filters),
    // Keeps the previous page on screen while the next one loads, so paging
    // does not flash an empty table.
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: productKeys.categories(),
    queryFn: () => productsService.listCategories(),
    // The category list barely changes; no need to keep refetching it.
    staleTime: 10 * 60_000,
  });
}

export function useProductBatches(productId: string) {
  return useQuery({
    queryKey: batchKeys.byProduct(productId),
    queryFn: () => inventoryService.getBatchesForProduct(productId),
    enabled: Boolean(productId),
  });
}

export function useProductMovements(productId: string) {
  return useQuery({
    queryKey: movementKeys.byProduct(productId),
    queryFn: () =>
      inventoryService.listMovements({ productId, pageSize: 50 }),
    enabled: Boolean(productId),
  });
}

export function useProductSales(productId: string) {
  return useQuery({
    queryKey: salesKeys.list({ productId, pageSize: 25 }),
    queryFn: () => salesService.list({ productId, pageSize: 25 }),
    enabled: Boolean(productId),
  });
}

/** Everything a catalogue change can make stale. */
function invalidateProductData(
  queryClient: ReturnType<typeof useQueryClient>,
  productId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: productKeys.all });
  void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
  void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  if (productId) {
    void queryClient.invalidateQueries({
      queryKey: productKeys.detail(productId),
    });
  }
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (input: ProductInput) =>
      productsService.create(input, user?.id ?? ""),
    onSuccess: (product) => {
      invalidateProductData(queryClient);
      toast({
        tone: "success",
        title: "Product created",
        description: `${product.name} has been added to the catalogue.`,
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not create product",
        description: toErrorMessage(error),
      });
    },
  });
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (input: ProductInput) =>
      productsService.update(id, input, user?.id ?? ""),
    onSuccess: (product) => {
      invalidateProductData(queryClient, id);
      toast({
        tone: "success",
        title: "Product updated",
        description: `${product.name} has been saved.`,
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not save product",
        description: toErrorMessage(error),
      });
    },
  });
}
