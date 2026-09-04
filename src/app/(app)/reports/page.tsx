import type { Metadata } from "next";

import { ReportsIndexPage } from "@/features/reports/ReportsIndexPage";

export const metadata: Metadata = {
  title: "Reports",
};

export default function Page() {
  return <ReportsIndexPage />;
}