import type { Metadata } from "next";

import { InventoryReportPage } from "@/features/reports/InventoryReportPage";

export const metadata: Metadata = {
  title: "Inventory Report",
};

export default function Page() {
  return <InventoryReportPage />;
}