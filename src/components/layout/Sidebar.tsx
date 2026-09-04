"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, LogOut, Monitor } from "lucide-react";

import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth/AuthProvider";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/status";
import { useTerminal } from "@/hooks/useTerminal";
import { Tooltip } from "@/components/ui/Tooltip";
import { isNavItemActive, NAV_GROUPS, type NavItem } from "./navigation";

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  const { terminal } = useTerminal();

  // Groups whose every item is denied to this role disappear entirely,
  // rather than leaving an empty heading behind.
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || hasAnyPermission(role, [item.permission]),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <aside
      data-print-hidden
      className={cn(
        "flex h-dvh shrink-0 flex-col border-r border-neutral-200 bg-white transition-[width] duration-150",
        collapsed ? "w-sidebar-collapsed" : "w-sidebar",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-topbar shrink-0 items-center border-b border-neutral-200",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4",
        )}
      >
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-md"
          aria-label="Mustan Healthcare Pharmacy — home"
        >
          {/* The square monogram, not the stacked lockup — the full lockup
              is illegible below about 120px. */}
          <Image
            src="/logo-mark.png"
            alt=""
            width={32}
            height={32}
            priority
            className="size-8 shrink-0 object-contain"
          />
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-base font-semibold text-primary-800">
                Mustan Healthcare
              </span>
              <span className="truncate text-micro font-medium uppercase tracking-wide text-success-700">
                Pharmacy
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Main navigation"
        className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
      >
        {visibleGroups.map((group) => (
          <div key={group.id} className="mb-2.5 last:mb-0">
            {!collapsed && (
              <p className="px-2 pb-1 text-micro font-semibold uppercase tracking-wide text-neutral-400">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink
                    item={item}
                    active={isNavItemActive(item, pathname)}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Terminal, user, sign out — kept to two compact rows so the whole
          navigation clears the fold at 1366×768. */}
      <div className="shrink-0 border-t border-neutral-200 p-2">
        <Tooltip content={`${terminal.name} · ${terminal.location}`} side="right">
          <div
            className={cn(
              "flex items-center gap-2 rounded-md bg-neutral-50 px-2 py-1",
              collapsed && "justify-center",
            )}
          >
            <Monitor
              className="size-3.5 shrink-0 text-neutral-400"
              aria-hidden
            />
            {!collapsed && (
              <span className="num truncate text-micro text-neutral-600">
                <span className="font-semibold">{terminal.shortName}</span>
                {" · "}
                {terminal.name}
              </span>
            )}
            {collapsed && (
              <span className="sr-only">
                {terminal.shortName} {terminal.name}
              </span>
            )}
          </div>
        </Tooltip>

        <div
          className={cn(
            "mt-1 flex items-center gap-2",
            collapsed && "flex-col gap-1",
          )}
        >
          {user && (
            <>
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-700 text-micro font-semibold text-white"
              >
                {initialsOf(user.name)}
              </span>
              {!collapsed && (
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-meta font-medium text-neutral-800">
                    {user.name}
                  </span>
                  <span className="truncate text-micro text-neutral-500">
                    {ROLE_LABELS[user.role]}
                  </span>
                </span>
              )}
            </>
          )}

          <Tooltip content="Sign out" side="right">
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Sign out"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-danger-50 hover:text-danger-700"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </Tooltip>

          <Tooltip
            content={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            side="right"
          >
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            >
              <ChevronLeft
                className={cn(
                  "size-4 transition-transform duration-150",
                  collapsed && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // 32px rows: fourteen items plus the footer must clear 768px height,
        // which is the most common terminal resolution in the pharmacy.
        "flex h-8 items-center gap-2.5 rounded-md px-2 text-base transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-primary-50 font-medium text-primary-800"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary-700" : "text-neutral-400",
        )}
        aria-hidden
      />
      {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  );
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
