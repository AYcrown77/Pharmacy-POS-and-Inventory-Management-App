import type { Metadata } from "next";

import { StockMovementReportPage } from "@/features/reports/StockMovementReportPage";

export const metadata: Metadata = {
  title: "Stock Movement Report",
};

export default function Page() {
  return <StockMovementReportPage />;
}