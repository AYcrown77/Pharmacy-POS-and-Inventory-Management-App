import {
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  PackagePlus,
  Pill,
  Receipt,
  RotateCcw,
  ScanBarcode,
  Settings,
  SlidersHorizontal,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omitted for items every signed-in user may open. */
  permission?: Permission;
  /** Also highlight this item for these path prefixes. */
  matchPrefixes?: string[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Grouped rather than a flat list of fourteen links — the sidebar is scanned
 * hundreds of times a day and headings make it findable at a glance.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        permission: "reports:read",
      },
      { href: "/pos", label: "POS / New Sale", icon: ScanBarcode, permission: "pos:use" },
      { href: "/sales", label: "Sales", icon: Receipt, permission: "sales:read:own" },
      { href: "/returns", label: "Returns", icon: RotateCcw, permission: "sales:refund" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    items: [
      { href: "/products", label: "Products", icon: Pill, permission: "products:read" },
      { href: "/inventory", label: "Inventory", icon: Warehouse, permission: "inventory:read" },
      { href: "/batches", label: "Batches", icon: Boxes, permission: "batches:read" },
      { href: "/stock/receive", label: "Stock Receiving", icon: PackagePlus, permission: "stock:receive" },
      { href: "/stock/adjustments", label: "Stock Adjustments", icon: SlidersHorizontal, permission: "stock:adjust" },
      { href: "/expiry", label: "Expiry Management", icon: AlertTriangle, permission: "inventory:read" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: FileBarChart, permission: "reports:read" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { href: "/users", label: "Users", icon: Users, permission: "users:manage" },
      { href: "/audit", label: "Audit Logs", icon: ClipboardList, permission: "audit:read" },
      { href: "/settings", label: "Settings", icon: Settings, permission: "settings:manage" },
    ],
  },
];

/** Page titles for the top bar, longest prefix wins. */
const ROUTE_TITLES: ReadonlyArray<readonly [string, string]> = [
  ["/dashboard", "Dashboard"],
  ["/pos", "Point of Sale"],
  ["/products/new", "New Product"],
  ["/products", "Products"],
  ["/inventory", "Inventory"],
  ["/batches", "Batches"],
  ["/stock/receive", "Stock Receiving"],
  ["/stock/adjustments", "Stock Adjustments"],
  ["/expiry", "Expiry Management"],
  ["/sales", "Sales"],
  ["/returns", "Returns"],
  ["/reports/sales", "Sales Report"],
  ["/reports/inventory", "Inventory Report"],
  ["/reports/expiry", "Expiry Report"],
  ["/reports/stock-movements", "Stock Movement Report"],
  ["/reports/cashiers", "Cashier Report"],
  ["/reports", "Reports"],
  ["/users", "User Management"],
  ["/audit", "Audit Log"],
  ["/settings", "Settings"],
];

export function titleForRoute(pathname: string): string {
  const match = ROUTE_TITLES.filter(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  ).sort((a, b) => b[0].length - a[0].length)[0];

  return match ? match[1] : "Mustan Healthcare Pharmacy";
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (pathname.startsWith(`${item.href}/`)) return true;
  return (
    item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix)) ?? false
  );
}

export { Activity };
