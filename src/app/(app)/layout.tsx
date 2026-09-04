import { AppShell } from "@/components/layout/AppShell";

/**
 * Every authenticated route renders inside the shell, which also runs the
 * session and permission guards.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
