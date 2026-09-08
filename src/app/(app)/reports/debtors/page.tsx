import type { Metadata } from "next";

import { DebtorsReportPage } from "@/features/reports/DebtorsReportPage";

export const metadata: Metadata = {
  title: "Debtors Report",
};

export default function Page() {
  return <DebtorsReportPage />;
}
