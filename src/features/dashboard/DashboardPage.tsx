"use client";

import dynamic from "next/dynamic";

import { Card, CardHeader } from "@/components/ui/Card";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoneyCompact } from "@/lib/money";
import { AlertStrip } from "./components/AlertStrip";
import {
  ExpiryAlertsPanel,
  LowStockPanel,
} from "./components/AlertPanels";
import {
  RecentActivityPanel,
  RecentSalesPanel,
} from "./components/ActivityPanels";
import { DashboardStats } from "./components/DashboardStats";
import { PaymentMixPanel } from "./components/PaymentMixPanel";
import { useDashboardSummary, useSalesTrend } from "./hooks";

/**
 * Recharts is the heaviest dependency in the application and only this screen
 * needs it, so it is split out of the main bundle. `ssr: false` because the
 * chart measures its own container, which has no size on the server.
 */
const SalesTrendChart = dynamic(
  () => import("./components/SalesTrendChart").then((m) => m.SalesTrendChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
);

const TREND_DAYS = 7;

export function DashboardPage() {
  const summary = useDashboardSummary();

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        titleHidden
        description="Today's trading, stock alerts and recent activity."
      />

      {summary.data && <AlertStrip inventory={summary.data.inventory} />}

      <DashboardStats
        data={summary.data}
        isPending={summary.isPending}
        isError={summary.isError}
        onRetry={() => void summary.refetch()}
      />

      {/* Trend takes two thirds; the payment split needs far less room. */}
      <div className="grid gap-4 xl:grid-cols-3">
        <SalesTrendCard className="xl:col-span-2" />
        <PaymentMixPanel days={TREND_DAYS} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ExpiryAlertsPanel />
        <LowStockPanel />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RecentSalesPanel />
        <RecentActivityPanel />
      </div>
    </PageContainer>
  );
}

function SalesTrendCard({ className }: { className?: string }) {
  const { data, isPending, isError, refetch } = useSalesTrend(TREND_DAYS);

  const total = data?.reduce((sum, point) => sum + point.total, 0) ?? 0;

  return (
    <Card className={className}>
      <CardHeader
        title="Sales trend"
        description={`Daily takings · last ${TREND_DAYS} days`}
        actions={
          data && (
            <span className="num text-base font-semibold text-neutral-900">
              {formatMoneyCompact(total)}
            </span>
          )
        }
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} className="py-10" />
      ) : isPending || !data ? (
        <ChartSkeleton />
      ) : (
        <SalesTrendChart data={data} />
      )}
    </Card>
  );
}

/** Shaped like the chart it replaces, so the card does not resize on load. */
function ChartSkeleton() {
  const heights = ["40%", "65%", "50%", "80%", "55%", "70%", "45%"];

  return (
    <div className="h-56 w-full px-4 pb-6 pt-4" role="status" aria-label="Loading chart">
      <div className="flex h-full items-end gap-3">
        {heights.map((height, index) => (
          <Skeleton
            key={index}
            className="flex-1 rounded-t-sm"
            // Inline because these are data-shaped, not design-token, values.
            style={{ height }}
          />
        ))}
      </div>
    </div>
  );
}
