import type { Metadata } from "next";

import { ProductDetailPage } from "@/features/products/ProductDetailPage";

export const metadata: Metadata = {
  title: "Product Details",
};

// `params` is a promise in Next 16 — it must be awaited.
export default async function Page(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  return <ProductDetailPage productId={id} />;
}
