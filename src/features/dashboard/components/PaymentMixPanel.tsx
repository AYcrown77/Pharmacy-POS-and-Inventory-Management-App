"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney, formatQuantity } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/status";
import type { PaymentMixEntry } from "@/types/analytics";
import { usePaymentMix } from "../hooks";

/**
 * How payment splits across the three methods.
 *
 * A ranked bar list rather than a pie or a three-colour chart, for a reason
 * the palette validator settled: the only three brand-appropriate hues put
 * navy and sky at ΔE 9.4 for normal vision — below the 15 floor, so full-colour
 * readers could not reliably tell those two bars apart.
 *
 * With identity carried by a text label instead, colour has no work to do, so
 * every bar takes the same hue and the exact figures stay readable. It is also
 * denser and prints correctly, which a pie is not.
 */
export function PaymentMixPanel({ days }: { days: number }) {
  const { data, isPending, isError, refetch } = usePaymentMix(days);

  const entries = data ? [...data].sort((a, b) => b.total - a.total) : [];
  const grandTotal = entries.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Payment methods"
        description={`Share of takings · last ${days} days`}
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} className="py-10" />
      ) : isPending ? (
        <div className="flex flex-col gap-4 p-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : grandTotal === 0 ? (
        <p className="px-4 py-10 text-center text-base text-neutral-500">
          No takings recorded in this period.
        </p>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-4 p-4">
          {entries.map((entry) => (
            <PaymentMixRow key={entry.method} entry={entry} />
          ))}

          <div className="mt-1 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="text-meta font-medium text-neutral-600">
              Total
            </span>
            <span className="num text-base font-semibold text-neutral-900">
              {formatMoney(grandTotal)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function PaymentMixRow({ entry }: { entry: PaymentMixEntry }) {
  const percent = Math.round(entry.share * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-medium text-neutral-800">
          {PAYMENT_METHOD_LABELS[entry.method]}
        </span>
        <span className="num shrink-0 text-base text-neutral-900">
          {formatMoney(entry.total)}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100"
          role="img"
          aria-label={`${PAYMENT_METHOD_LABELS[entry.method]}: ${percent}% of takings`}
        >
          <div
            className="h-full rounded-full bg-[#2A5EAB]"
            style={{ width: `${Math.max(entry.share * 100, 1.5)}%` }}
          />
        </div>
        <span className="num w-8 shrink-0 text-right text-meta text-neutral-500">
          {percent}%
        </span>
      </div>

      <p className="num text-micro text-neutral-400">
        {formatQuantity(entry.transactions)}{" "}
        {entry.transactions === 1 ? "transaction" : "transactions"}
      </p>
    </div>
  );
}
