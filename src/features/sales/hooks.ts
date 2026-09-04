"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import { returnKeys, salesKeys, settingsKeys, userKeys } from "@/lib/query/keys";
import { returnsService } from "@/services/returns.service";
import { salesService, type SaleFilters } from "@/services/sales.service";
import { systemService } from "@/services/system.service";
import { usersService } from "@/services/users.service";

/**
 * Sales list, scoped to what the signed-in role may see.
 *
 * A cashier holds `sales:read:own` but not `sales:read:all`, so their id is
 * pinned into the filter. This is a convenience, not a control: the Express
 * API must apply the same scope from the session, or a crafted request would
 * return another cashier's takings.
 */
export function useSales(filters: SaleFilters) {
  const { user, can } = useAuth();
  const scoped: SaleFilters = can("sales:read:all")
    ? filters
    : { ...filters, cashierId: user?.id };

  return useQuery({
    queryKey: salesKeys.list(scoped),
    queryFn: () => salesService.list(scoped),
    placeholderData: keepPreviousData,
  });
}

export function useSale(id: string) {
  return useQuery({
    queryKey: salesKeys.detail(id),
    queryFn: () => salesService.getById(id),
    enabled: Boolean(id),
  });
}

export function useSaleReturns(saleId: string) {
  return useQuery({
    queryKey: returnKeys.bySale(saleId),
    queryFn: () => returnsService.forSale(saleId),
    enabled: Boolean(saleId),
  });
}

/** Pharmacy details for the receipt header. */
export function usePharmacySettings() {
  return useQuery({
    queryKey: settingsKeys.pharmacy(),
    queryFn: () => systemService.getSettings(),
    staleTime: 10 * 60_000,
  });
}

/** Cashiers, for the sales filter. Admin-only data, so it is gated. */
export function useCashiers() {
  const { can } = useAuth();

  return useQuery({
    queryKey: userKeys.list({ pageSize: 100 }),
    queryFn: () => usersService.list({ pageSize: 100 }),
    enabled: can("sales:read:all"),
    staleTime: 5 * 60_000,
  });
}
