import type { Metadata } from "next";
import { Suspense } from "react";

import { SkeletonCard } from "@/components/ui/Skeleton";
import { StockReceivingPage } from "@/features/stock-receiving/StockReceivingPage";

export const metadata: Metadata = {
  title: "Stock Receiving",
};

export default function Page() {
  // The form reads `?productId=` to support deep links from low-stock alerts,
  // and `useSearchParams` must sit inside a Suspense boundary.
  return (
    <Suspense fallback={<SkeletonCard className="m-6 h-[32rem]" />}>
      <StockReceivingPage />
    </Suspense>
  );
}
