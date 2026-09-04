import type { Metadata } from "next";

import { NewProductPage } from "@/features/products/ProductFormPage";

export const metadata: Metadata = {
  title: "New Product",
};

export default function Page() {
  return <NewProductPage />;
}
