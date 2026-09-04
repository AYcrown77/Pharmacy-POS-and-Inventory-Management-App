"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { usePersistentFlag } from "@/hooks/usePersistentFlag";
import { useAuth } from "@/lib/auth/AuthProvider";
import { canAccessRoute } from "@/lib/auth/permissions";
import { ForbiddenState } from "@/components/ui/States";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const SIDEBAR_STORAGE_KEY = "mhp.sidebar-collapsed";

/**
 * The authenticated frame.
 *
 * A fixed-height flex column, deliberately: the page itself must never scroll,
 * so tables and the POS panel scroll inside their own regions. This is what
 * keeps "Complete Sale" above the fold at 1366×768.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated, role } = useAuth();

  const [collapsed, setCollapsed] = usePersistentFlag(SIDEBAR_STORAGE_KEY);

  // The POS needs every pixel of height and width it can get.
  const isPos = pathname === "/pos";
  const effectiveCollapsed = isPos || collapsed;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <ShellSkeleton />;
  }

  if (!isAuthenticated) {
    // The redirect above is in flight; render nothing rather than flashing
    // the shell to a signed-out user.
    return null;
  }

  const allowed = canAccessRoute(role, pathname);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar
        collapsed={effectiveCollapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar compact={isPos} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {allowed ? (
            children
          ) : (
            <ForbiddenState onGoBack={() => router.back()} />
          )}
        </main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <div className="w-sidebar shrink-0 border-r border-neutral-200 bg-white" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-topbar shrink-0 border-b border-neutral-200 bg-white" />
        <div className="flex-1" />
      </div>
      <span className="sr-only" role="status">
        Loading the application
      </span>
    </div>
  );
}
