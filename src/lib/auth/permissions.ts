/**
 * Authorization.
 *
 * Permissions — not roles — are the unit of access. Navigation, route guards
 * and individual actions all resolve through this one table, so a role change
 * is a single edit here rather than a hunt through components.
 *
 * This is a USABILITY layer, not a security boundary. The Express API remains
 * the enforcer; the frontend still issues requests and renders a real 401/403
 * when the server refuses, so the UI stays honest once the backend is live.
 */

import type { Role } from "@/types/domain";

export type Permission =
  // Point of sale
  | "pos:use"
  // Sales
  | "sales:read:own"
  | "sales:read:all"
  | "sales:refund"
  // Catalogue
  | "products:read"
  | "products:write"
  // Stock
  | "inventory:read"
  | "batches:read"
  | "stock:receive"
  | "stock:adjust"
  // Back office
  | "reports:read"
  | "users:manage"
  | "audit:read"
  | "settings:manage";

/**
 * Role → permissions, following §8.1 of the specification.
 *
 * Cashier: search, scan, create sales, take payment, print receipts,
 *          view OWN transactions, perform permitted sale reversals.
 *
 * The specification also describes a Pharmacist/Dispenser role; it is out of
 * scope for this build, so the pharmacy runs on administrators and cashiers.
 * Adding it back is an entry in this table plus a label in `lib/status.ts` —
 * nothing else in the application branches on a role directly.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMINISTRATOR: [
    "pos:use",
    "sales:read:own",
    "sales:read:all",
    "sales:refund",
    "products:read",
    "products:write",
    "inventory:read",
    "batches:read",
    "stock:receive",
    "stock:adjust",
    "reports:read",
    "users:manage",
    "audit:read",
    "settings:manage",
  ],
  CASHIER: ["pos:use", "sales:read:own", "sales:refund", "products:read"],
};

export function hasPermission(
  role: Role | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** True when the role holds at least one of the given permissions. */
export function hasAnyPermission(
  role: Role | null | undefined,
  permissions: readonly Permission[],
): boolean {
  if (!role) return false;
  if (permissions.length === 0) return true;
  return permissions.some((permission) => hasPermission(role, permission));
}

/** True when the role holds every one of the given permissions. */
export function hasAllPermissions(
  role: Role | null | undefined,
  permissions: readonly Permission[],
): boolean {
  if (!role) return false;
  return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Where each role lands after signing in. A cashier's job is the till, so
 * that is their home — not a dashboard they cannot act on.
 */
export const ROLE_HOME_ROUTE: Record<Role, string> = {
  ADMINISTRATOR: "/dashboard",
  CASHIER: "/pos",
};

/**
 * Route → permissions required to open it.
 *
 * Matched longest-prefix-first, so `/products/new` can demand write access
 * while `/products` needs only read. Routes absent from this table are open
 * to any signed-in user.
 */
const ROUTE_PERMISSIONS: ReadonlyArray<readonly [string, Permission]> = [
  // The dashboard is a summary report: pharmacy-wide takings, inventory value
  // and stock alerts. A cashier's work is the till, and their home is /pos.
  ["/dashboard", "reports:read"],
  ["/pos", "pos:use"],
  ["/products/new", "products:write"],
  ["/products", "products:read"],
  ["/inventory", "inventory:read"],
  ["/batches", "batches:read"],
  ["/stock/receive", "stock:receive"],
  ["/stock/adjustments", "stock:adjust"],
  ["/expiry", "inventory:read"],
  ["/sales", "sales:read:own"],
  ["/returns", "sales:refund"],
  ["/reports", "reports:read"],
  ["/users", "users:manage"],
  ["/audit", "audit:read"],
  ["/settings", "settings:manage"],
];

/** The permission a pathname requires, or null when it needs none. */
export function permissionForRoute(pathname: string): Permission | null {
  // `/products/:id/edit` needs write access even though the prefix table
  // only lists `/products/new` explicitly.
  if (/^\/products\/[^/]+\/edit$/.test(pathname)) return "products:write";

  const match = ROUTE_PERMISSIONS.filter(([prefix]) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  ).sort((a, b) => b[0].length - a[0].length)[0];

  return match ? match[1] : null;
}

export function canAccessRoute(
  role: Role | null | undefined,
  pathname: string,
): boolean {
  const permission = permissionForRoute(pathname);
  if (!permission) return Boolean(role);
  return hasPermission(role, permission);
}
