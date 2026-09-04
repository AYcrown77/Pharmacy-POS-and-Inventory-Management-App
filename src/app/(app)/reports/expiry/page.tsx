import type { Metadata } from "next";

import { ExpiryReportPage } from "@/features/reports/ExpiryReportPage";

export const metadata: Metadata = {
  title: "Expiry Report",
};

export default function Page() {
  return <ExpiryReportPage />;
}