"use client";

import { Download, Printer } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatCardSkeleton } from "@/components/ui/StatCard";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/date";
import { printReport } from "@/lib/print";
import { usePharmacySettings } from "@/features/sales/hooks";
import type { DateRange } from "@/types/common";

/**
 * One layout for every report: filters, summary figures, then the table.
 *
 * The printed sheet needs context the screen gets from its chrome — which
 * pharmacy, which report, which period — so a print-only header is rendered
 * inside the print root and hidden on screen.
 */
export function ReportShell({
  title,
  description,
  range,
  filters,
  summary,
  children,
  onExport,
}: {
  title: string;
  description: string;
  /** Printed in the header so a sheet on a desk explains itself. */
  range?: DateRange;
  filters: ReactNode;
  summary: ReactNode;
  children: ReactNode;
  onExport?: () => void;
}) {
  const settings = usePharmacySettings();

  return (
    <PageContainer>
      <div data-print-hidden>
        <PageHeader
          title={title}
          titleHidden
          breadcrumbs={[{ label: "Reports", href: "/reports" }, { label: title }]}
          description={description}
          actions={
            <>
              <Tooltip content="Export is not part of the MVP yet">
                <span>
                  <Button
                    variant="secondary"
                    disabled={!onExport}
                    onClick={onExport}
                    leadingIcon={<Download className="size-4" />}
                  >
                    Export
                  </Button>
                </span>
              </Tooltip>
              <Button
                variant="primary"
                onClick={printReport}
                leadingIcon={<Printer className="size-4" />}
              >
                Print
              </Button>
            </>
          }
        />
      </div>

      <div data-print-hidden>{filters}</div>

      {/* Everything below is what reaches the paper. */}
      <div data-print-root="report" className="flex flex-col gap-5">
        <header className="hidden print:block">
          <p className="text-title font-semibold text-black">
            {settings.data?.name ?? "Mustan Healthcare Pharmacy"}
          </p>
          <p className="text-base text-black">{title}</p>
          {range && (
            <p className="num text-meta text-black">
              {formatDate(range.from)} – {formatDate(range.to)}
            </p>
          )}
        </header>

        {summary}
        {children}
      </div>
    </PageContainer>
  );
}

/** Summary figures above a report table. */
export function ReportSummary({
  items,
  isPending,
  columns = 4,
}: {
  items: Array<{
    label: string;
    value: string;
    context?: string;
    tone?: "warning" | "danger";
    accent?: boolean;
    /**
     * Turns the tile into a filter chip. Reports whose summary bands are also
     * the useful filters — expiry, above all — read as clickable whether or
     * not they are, so a tile that does nothing when pressed reads as broken.
     */
    onSelect?: () => void;
    selected?: boolean;
  }>;
  isPending?: boolean;
  columns?: 3 | 4 | 5 | 6;
}) {
  const gridClass = {
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 xl:grid-cols-4",
    5: "grid-cols-2 xl:grid-cols-5",
    6: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  }[columns];

  if (isPending) {
    return (
      <div className={`grid gap-3 ${gridClass}`}>
        {Array.from({ length: columns }, (_, index) => (
          <StatCardSkeleton key={index} size="sm" />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {items.map((item) => {
        const card = (
          <StatCard
            size="sm"
            label={item.label}
            value={item.value}
            context={item.context}
            tone={item.tone}
            accent={item.accent}
          />
        );

        if (!item.onSelect) return <Fragment key={item.label}>{card}</Fragment>;

        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onSelect}
            // A toggle rather than a link: pressing it again clears the filter.
            aria-pressed={item.selected}
            className={cn(
              "rounded-lg text-left transition",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400",
              item.selected
                ? "ring-2 ring-primary-600 ring-offset-1"
                : "hover:ring-2 hover:ring-neutral-300",
            )}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}
