import type { Metadata } from "next";

import { PosPage } from "@/features/pos/PosPage";

export const metadata: Metadata = {
  title: "Point of Sale",
};

export default function Page() {
  return <PosPage />;
}
