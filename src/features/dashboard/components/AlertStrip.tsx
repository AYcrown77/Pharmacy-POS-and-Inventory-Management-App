"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { formatQuantity } from "@/lib/money";
import type { InventorySummary } from "@/types/analytics";

/**
 * A single line of "act on this", shown only when there is something to act on.
 *
 * One strip rather than a stack of alert cards: an administrator opening the
 * dashboard should see either nothing here, or exactly one sentence telling
 * them what needs doing.
 */
export function AlertStrip({ inventory }: { inventory: InventorySummary }) {
  const problems: Array<{ label: string; href: string }> = [];

  if (inventory.expiredCount > 0) {
    problems.push({
      label: `${formatQuantity(inventory.expiredCount)} expired ${
        inventory.expiredCount === 1 ? "batch" : "batches"
      }`,
      href: "/expiry",
    });
  }

  if (inventory.outOfStockCount > 0) {
    problems.push({
      label: `${formatQuantity(inventory.outOfStockCount)} ${
        inventory.outOfStockCount === 1 ? "product" : "products"
      } out of stock`,
      href: "/inventory",
    });
  }

  if (problems.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-danger-50 px-3.5 py-2.5 ring-1 ring-inset ring-danger-200"
    >
      <AlertTriangle
        className="size-4 shrink-0 text-danger-600"
        aria-hidden
      />
      <p className="text-base text-danger-800">
        {problems.map((problem, index) => (
          <span key={problem.href}>
            {index > 0 && <span className="text-danger-400"> · </span>}
            <Link
              href={problem.href}
              className="font-medium underline decoration-danger-300 underline-offset-2 hover:decoration-danger-600"
            >
              {problem.label}
            </Link>
          </span>
        ))}
        <span className="text-danger-700"> need attention.</span>
      </p>
    </div>
  );
}
