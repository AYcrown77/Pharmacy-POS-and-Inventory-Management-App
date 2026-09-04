import type { Metadata } from "next";

import { ProductsPage } from "@/features/products/ProductsPage";

export const metadata: Metadata = {
  title: "Products",
};

export default function Page() {
  return <ProductsPage />;
}
