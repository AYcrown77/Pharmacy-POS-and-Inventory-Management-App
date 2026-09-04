import type { Metadata } from "next";

import { SalesPage } from "@/features/sales/SalesPage";

export const metadata: Metadata = {
  title: "Sales",
};

export default function Page() {
  return <SalesPage />;
}
