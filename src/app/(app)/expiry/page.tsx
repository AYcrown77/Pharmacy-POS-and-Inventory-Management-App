import type { Metadata } from "next";

import { ExpiryPage } from "@/features/expiry/ExpiryPage";

export const metadata: Metadata = {
  title: "Expiry Management",
};

export default function Page() {
  return <ExpiryPage />;
}
