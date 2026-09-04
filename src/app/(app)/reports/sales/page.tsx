import type { Metadata } from "next";

import { SalesReportPage } from "@/features/reports/SalesReportPage";

export const metadata: Metadata = {
  title: "Sales Report",
};

export default function Page() {
  return <SalesReportPage />;
}