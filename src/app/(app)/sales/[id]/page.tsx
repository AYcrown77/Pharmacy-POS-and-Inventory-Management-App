import type { Metadata } from "next";

import { SaleDetailPage } from "@/features/sales/SaleDetailPage";

export const metadata: Metadata = {
  title: "Sale Details",
};

export default async function Page(props: PageProps<"/sales/[id]">) {
  const { id } = await props.params;
  return <SaleDetailPage saleId={id} />;
}
