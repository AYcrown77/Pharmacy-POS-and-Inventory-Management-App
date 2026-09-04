import type { Metadata } from "next";
import { Suspense } from "react";

import { SkeletonCard } from "@/components/ui/Skeleton";
import { StockAdjustmentsPage } from "@/features/stock-adjustments/StockAdjustmentsPage";

export const metadata: Metadata = {
  title: "Stock Adjustments",
};

export default function Page() {
  // Reads `?productId=`, `?batchId=` and `?reason=` when arriving from the
  // expiry page, so it needs a Suspense boundary.
  return (
    <Suspense fallback={<SkeletonCard className="m-6 h-[32rem]" />}>
      <StockAdjustmentsPage />
    </Suspense>
  );
}
