"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { useToast } from "@/components/ui/Toast";
import { toErrorMessage } from "@/lib/api/http";
import { useAuth } from "@/lib/auth/AuthProvider";
import { adjustmentKeys } from "@/lib/query/keys";
import { formatQuantity } from "@/lib/money";
import { useInvalidateStock } from "@/features/stock-receiving/hooks";
import {
  stockService,
  type AdjustmentFilters,
  type AdjustStockInput,
} from "@/services/stock.service";

export function useAdjustments(filters: AdjustmentFilters) {
  return useQuery({
    queryKey: adjustmentKeys.list(filters),
    queryFn: () => stockService.listAdjustments(filters),
  });
}

export function useAdjustStock() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateStock();

  return useMutation({
    mutationFn: (input: Omit<AdjustStockInput, "userId">) =>
      stockService.adjust({ ...input, userId: user?.id ?? "" }),
    onSuccess: (adjustment) => {
      invalidate();
      toast({
        tone: "success",
        title: "Stock adjusted",
        description: `${adjustment.productName} batch ${
          adjustment.batchNumber
        } changed from ${formatQuantity(
          adjustment.quantityBefore,
        )} to ${formatQuantity(adjustment.quantityAfter)} units.`,
      });
    },
    onError: (error) => {
      toast({
        tone: "error",
        title: "Could not adjust stock",
        description: toErrorMessage(error),
      });
    },
  });
}
