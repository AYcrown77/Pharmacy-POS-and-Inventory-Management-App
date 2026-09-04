"use client";

import { ArrowRight } from "lucide-react";

import { AuditActionBadge } from "@/components/shared/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/date";
import type { AuditLog } from "@/types/domain";
import { formatAuditValue, humanise } from "../format";

/**
 * The old/new comparison for one audited action.
 *
 * Where both sides exist the fields are shown side by side so the change is
 * readable at a glance — that is the whole reason the log records both.
 */
export function AuditDetail({ entry }: { entry: AuditLog }) {
  const oldValue = entry.oldValue ?? {};
  const newValue = entry.newValue ?? {};
  const keys = [
    ...new Set([...Object.keys(oldValue), ...Object.keys(newValue)]),
  ];

  const hasComparison =
    Object.keys(oldValue).length > 0 && Object.keys(newValue).length > 0;

  return (
    <div className="flex flex-col gap-5">
      <DescriptionList
        columns={2}
        items={[
          {
            label: "Action",
            value: <AuditActionBadge action={entry.action} size="sm" />,
          },
          {
            label: "Entity",
            value: <Badge tone="neutral" size="sm">{entry.entityType}</Badge>,
          },
          { label: "Performed by", value: entry.userName },
          { label: "When", value: formatDateTime(entry.createdAt) },
          {
            label: "Record reference",
            value: entry.entityId ? (
              <span className="num font-mono text-sm">{entry.entityId}</span>
            ) : null,
            wide: true,
          },
        ]}
      />

      {keys.length === 0 ? (
        <p className="rounded-md bg-neutral-50 px-3 py-3 text-base text-neutral-500 ring-1 ring-inset ring-neutral-200">
          This action recorded no field-level changes.
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          <h3 className="text-section font-semibold text-neutral-900">
            {hasComparison ? "What changed" : "Recorded values"}
          </h3>

          <div className="overflow-hidden rounded-md ring-1 ring-inset ring-neutral-200">
            <div
              className={cn(
                "grid gap-3 bg-neutral-50 px-3 py-2 text-micro font-semibold uppercase tracking-wide text-neutral-500",
                hasComparison
                  ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1rem_minmax(0,1fr)]"
                  : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
              )}
              aria-hidden
            >
              <span>Field</span>
              {hasComparison ? (
                <>
                  <span>Before</span>
                  <span />
                  <span>After</span>
                </>
              ) : (
                <span>Value</span>
              )}
            </div>

            <dl>
              {keys.map((key) => {
                const before = oldValue[key];
                const after = newValue[key];
                const changed =
                  hasComparison &&
                  JSON.stringify(before) !== JSON.stringify(after);

                return (
                  <div
                    key={key}
                    className={cn(
                      "grid items-baseline gap-3 border-t border-neutral-100 px-3 py-2 text-base",
                      hasComparison
                        ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1rem_minmax(0,1fr)]"
                        : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
                    )}
                  >
                    <dt className="truncate text-neutral-500">
                      {humanise(key)}
                    </dt>

                    {hasComparison ? (
                      <>
                        <dd
                          className={cn(
                            "num truncate",
                            changed
                              ? "text-neutral-500 line-through"
                              : "text-neutral-700",
                          )}
                        >
                          {formatAuditValue(key, before)}
                        </dd>
                        <span aria-hidden className="text-neutral-300">
                          <ArrowRight className="size-3.5" />
                        </span>
                        <dd
                          className={cn(
                            "num truncate",
                            changed
                              ? "font-medium text-neutral-900"
                              : "text-neutral-700",
                          )}
                        >
                          {formatAuditValue(key, after)}
                        </dd>
                      </>
                    ) : (
                      <dd className="num truncate text-neutral-900">
                        {formatAuditValue(
                          key,
                          key in newValue ? after : before,
                        )}
                      </dd>
                    )}
                  </div>
                );
              })}
            </dl>
          </div>
        </section>
      )}
    </div>
  );
}

