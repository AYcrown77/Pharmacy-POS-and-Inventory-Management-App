import type { Metadata } from "next";

import { CashierReportPage } from "@/features/reports/CashierReportPage";

export const metadata: Metadata = {
  title: "Cashier Report",
};

export default function Page() {
  return <CashierReportPage />;
}