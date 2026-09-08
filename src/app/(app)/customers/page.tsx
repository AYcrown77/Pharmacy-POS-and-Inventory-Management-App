import type { Metadata } from "next";

import { CustomersPage } from "@/features/customers/CustomersPage";

export const metadata: Metadata = {
  title: "Customers",
};

export default function Page() {
  return <CustomersPage />;
}
