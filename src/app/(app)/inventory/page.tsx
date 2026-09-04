import type { Metadata } from "next";

import { InventoryPage } from "@/features/inventory/InventoryPage";

export const metadata: Metadata = {
  title: "Inventory",
};

export default function Page() {
  return <InventoryPage />;
}
