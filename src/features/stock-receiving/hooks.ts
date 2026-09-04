"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/ui/Toast";
import { toErrorMessage } from "@/lib/api/http";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  adjustmentKeys,
  auditKeys,
  STOCK_AFFECTING_KEYS,
} from "@/lib/query/keys";
import { formatQuantity } from "@/lib/money";
import { stockService, type ReceiveStockInput } from "@/services/stock.service";

/**
 * Invalidate everything a stock write makes stale.
 *
 * Receiving or adjusting changes batch quantities, so inventory totals,
 * expiry bands, the movement ledger, the dashboard and every report are all
 * affected. Listing them by hand at each call site guarantees one gets missed.
 */
export function useInvalidateStock() {
  const queryClient = useQueryClient();

  return () => {
    for (const key of STOCK_AFFECTING_KEYS) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
    void queryClient.invalidateQueries({ queryKey: adjustmentKeys.all });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: () => stockService.listSuppliers(),
    staleTime: 5 * 60_000,
  });
}

export function useReceiveStock() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateStock();

  return useMutation({
    mutationFn: (input: Omit<ReceiveStockInput, "userId">) =>
      stockService.receive({ ...input, userId: user?.id ?? "" }),
    onSuccess: (batch) => {
      invalidate();
      toast({
        tone: "success",
        title: "Stock received",
        description: `${formatQuantity(batch.quantityReceived)} units of ${
          batch.product?.name ?? "the product"
        } added as batch ${batch.batchNumber}.`,
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not receive stock",
        description: toErrorMessage(error),
      });
    },
  });
}
