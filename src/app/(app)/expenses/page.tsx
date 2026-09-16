import type { Metadata } from "next";

import { ExpensesPage } from "@/features/expenses/ExpensesPage";

export const metadata: Metadata = {
  title: "Expenses",
};

export default function Page() {
  return <ExpensesPage />;
}
