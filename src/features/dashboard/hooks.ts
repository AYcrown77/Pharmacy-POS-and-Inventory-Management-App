"use client";

import { useQuery } from "@tanstack/react-query";

import {
  batchKeys,
  dashboardKeys,
  inventoryKeys,
  movementKeys,
  salesKeys,
} from "@/lib/query/keys";
import { dashboardService } from "@/services/dashboard.service";
import { inventoryService } from "@/services/inventory.service";
import { salesService } from "@/services/sales.service";

/**
 * Each panel owns its own query so it can show its own skeleton and fail
 * independently — one slow report should not hold up the whole dashboard.
 *
 * `staleTime` is shorter than the application default here: the dashboard is
 * the screen an administrator leaves open, and today's figures move.
 */
const DASHBOARD_STALE_TIME = 60_000;

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => dashboardService.getSummary(),
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useSalesTrend(days: number) {
  return useQuery({
    queryKey: dashboardKeys.salesTrend(days),
    queryFn: () => dashboardService.getSalesTrend(days),
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function usePaymentMix(days: number) {
  return useQuery({
    queryKey: dashboardKeys.paymentMix(days),
    queryFn: () => dashboardService.getPaymentMix(days),
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useExpiryAlerts(limit = 6) {
  return useQuery({
    queryKey: batchKeys.expiryAlerts(limit),
    queryFn: () => inventoryService.getExpiryAlerts(limit),
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useLowStockAlerts(limit = 6) {
  return useQuery({
    queryKey: inventoryKeys.lowStock(limit),
    queryFn: () => inventoryService.getLowStock(limit),
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useRecentSales(limit = 6) {
  return useQuery({
    queryKey: salesKeys.recent(limit),
    queryFn: () => salesService.getRecent(limit),
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useRecentMovements(limit = 6) {
  return useQuery({
    queryKey: movementKeys.recent(limit),
    queryFn: () => inventoryService.getRecentMovements(limit),
    staleTime: DASHBOARD_STALE_TIME,
  });
}
