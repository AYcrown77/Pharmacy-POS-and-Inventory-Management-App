import { AlertTriangle, ArrowDownRight, ArrowUpRight, Ban } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { formatQuantity } from "@/lib/money";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONES,
  EXPIRY_STATUS_LABELS,
  EXPIRY_STATUS_TONES,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_TONES,
  PAYMENT_METHOD_SHORT_LABELS,
  ROLE_LABELS,
  ROLE_TONES,
  SALE_STATUS_LABELS,
  SALE_STATUS_TONES,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_TONES,
} from "@/lib/status";
import type {
  AuditAction,
  ExpiryStatus,
  MovementType,
  PaymentMethod,
  Role,
  SaleStatus,
  StockStatus,
} from "@/types/domain";

/**
 * One badge per status family. Every screen uses these, so a status looks
 * and reads identically wherever it appears.
 */

export function StockStatusBadge({
  status,
  size = "md",
}: {
  status: StockStatus;
  size?: "sm" | "md";
}) {
  return (
    <Badge
      tone={STOCK_STATUS_TONES[status]}
      size={size}
      dot
      icon={
        status === "OUT_OF_STOCK" ? (
          <Ban className="size-3" aria-hidden />
        ) : undefined
      }
    >
      {STOCK_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ExpiryStatusBadge({
  status,
  size = "md",
}: {
  status: ExpiryStatus;
  size?: "sm" | "md";
}) {
  return (
    <Badge
      tone={EXPIRY_STATUS_TONES[status]}
      size={size}
      icon={
        status === "EXPIRED" || status === "CRITICAL_30" ? (
          <AlertTriangle className="size-3" aria-hidden />
        ) : undefined
      }
    >
      {EXPIRY_STATUS_LABELS[status]}
    </Badge>
  );
}

export function MovementTypeBadge({
  type,
  size = "md",
}: {
  type: MovementType;
  size?: "sm" | "md";
}) {
  return (
    <Badge tone={MOVEMENT_TYPE_TONES[type]} size={size}>
      {MOVEMENT_TYPE_LABELS[type]}
    </Badge>
  );
}

export function SaleStatusBadge({
  status,
  size = "md",
}: {
  status: SaleStatus;
  size?: "sm" | "md";
}) {
  return (
    <Badge tone={SALE_STATUS_TONES[status]} size={size} dot>
      {SALE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function RoleBadge({
  role,
  size = "md",
}: {
  role: Role;
  size?: "sm" | "md";
}) {
  return (
    <Badge tone={ROLE_TONES[role]} size={size}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

export function PaymentMethodBadge({
  method,
  size = "md",
}: {
  method: PaymentMethod;
  size?: "sm" | "md";
}) {
  return (
    <Badge tone="neutral" size={size}>
      {PAYMENT_METHOD_SHORT_LABELS[method]}
    </Badge>
  );
}

export function AuditActionBadge({
  action,
  size = "md",
}: {
  action: AuditAction;
  size?: "sm" | "md";
}) {
  return (
    <Badge tone={AUDIT_ACTION_TONES[action]} size={size}>
      {AUDIT_ACTION_LABELS[action]}
    </Badge>
  );
}

/**
 * A signed stock delta. The arrow carries the direction so the meaning
 * survives without colour; the tone is supplied by the movement type, which
 * is why a routine sale reads neutral rather than alarming.
 */
export function QuantityDelta({
  value,
  tone = "auto",
}: {
  value: number;
  tone?: "auto" | "neutral";
}) {
  const isPositive = value > 0;
  const colour =
    tone === "neutral"
      ? "text-neutral-600"
      : isPositive
        ? "text-success-700"
        : "text-neutral-700";

  return (
    <span className={`num inline-flex items-center gap-1 font-medium ${colour}`}>
      {isPositive ? (
        <ArrowUpRight className="size-3.5" aria-hidden />
      ) : (
        <ArrowDownRight className="size-3.5" aria-hidden />
      )}
      {isPositive ? "+" : "−"}
      {formatQuantity(Math.abs(value))}
    </span>
  );
}
