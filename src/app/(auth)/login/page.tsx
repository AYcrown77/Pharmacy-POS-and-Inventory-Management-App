import type { Metadata } from "next";

import { LoginPage } from "@/features/auth/LoginPage";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function Page() {
  return <LoginPage />;
}
