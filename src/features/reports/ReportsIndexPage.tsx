"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  FileBarChart,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { ClipboardList } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

interface ReportLink {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const REPORTS: ReportLink[] = [
  {
    href: "/reports/sales",
    title: "Sales report",
    description:
      "Takings, transaction count, average sale and the split across payment methods.",
    icon: FileBarChart,
  },
  {
    href: "/reports/inventory",
    title: "Inventory report",
    description:
      "Stock on hand, batch counts and inventory value across the catalogue.",
    icon: Warehouse,
  },
  {
    href: "/reports/expiry",
    title: "Expiry report",
    description:
      "Batches by remaining shelf life, with the value at risk in each band.",
    icon: CalendarClock,
  },
  {
    href: "/reports/stock-movements",
    title: "Stock movement report",
    description:
      "The full ledger of how inventory entered and left the pharmacy.",
    icon: ClipboardList,
  },
  {
    href: "/reports/cashiers",
    title: "Cashier report",
    description:
      "Takings per cashier, broken down by payment method for reconciliation.",
    icon: Users,
  },
];

export function ReportsIndexPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        titleHidden
        description="Every report can be filtered by period and printed."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href} className="group">
              <Card className="flex h-full items-start gap-3 p-4 transition-colors group-hover:border-primary-300 group-hover:bg-primary-50/30">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700"
                  aria-hidden
                >
                  <Icon className="size-4.5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-section font-semibold text-neutral-900">
                    {report.title}
                    <ArrowRight
                      className="size-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-0.5 block text-base text-neutral-500">
                    {report.description}
                  </span>
                </span>
              </Card>
            </Link>
          );
        })}
      </div>
    </PageContainer>
  );
}
