"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Entry point. Sends each role to the screen they actually work in —
 * a cashier's home is the till, not a dashboard they cannot act on.
 */
export default function RootPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, homeRoute } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(isAuthenticated ? homeRoute : "/login");
  }, [isLoading, isAuthenticated, homeRoute, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <span className="sr-only" role="status">
        Loading Mustan Healthcare Pharmacy
      </span>
    </div>
  );
}
