import type { Metadata } from "next";

import { UsersPage } from "@/features/users/UsersPage";

export const metadata: Metadata = {
  title: "User Management",
};

export default function Page() {
  return <UsersPage />;
}
