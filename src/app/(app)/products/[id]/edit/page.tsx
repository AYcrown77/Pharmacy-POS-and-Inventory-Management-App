import type { Metadata } from "next";

import { EditProductPage } from "@/features/products/ProductFormPage";

export const metadata: Metadata = {
  title: "Edit Product",
};

export default async function Page(props: PageProps<"/products/[id]/edit">) {
  const { id } = await props.params;
  return <EditProductPage productId={id} />;
}
