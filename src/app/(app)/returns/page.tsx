import type { Metadata } from "next";
import { Suspense } from "react";

import { SkeletonCard } from "@/components/ui/Skeleton";
import { ReturnsPage } from "@/features/returns/ReturnsPage";

export const metadata: Metadata = {
  title: "Returns",
};

export default function Page() {
  // Reads `?receipt=` when arriving from a sale, so it needs a boundary.
  return (
    <Suspense fallback={<SkeletonCard className="m-6 h-72" />}>
      <ReturnsPage />
    </Suspense>
  );
}
