import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type AlertTone = "info" | "success" | "warning" | "danger";

const TONES: Record<
  AlertTone,
  { container: string; icon: ReactNode; title: string }
> = {
  info: {
    container: "bg-info-50 ring-info-200",
    icon: <Info className="size-4 text-info-600" />,
    title: "text-info-800",
  },
  success: {
    container: "bg-success-50 ring-success-200",
    icon: <CheckCircle2 className="size-4 text-success-600" />,
    title: "text-success-800",
  },
  warning: {
    container: "bg-warning-50 ring-warning-200",
    icon: <AlertTriangle className="size-4 text-warning-600" />,
    title: "text-warning-800",
  },
  danger: {
    container: "bg-danger-50 ring-danger-200",
    icon: <XCircle className="size-4 text-danger-600" />,
    title: "text-danger-800",
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles = TONES[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md px-3.5 py-3 ring-1 ring-inset",
        styles.container,
        className,
      )}
    >
      <span className="mt-px shrink-0" aria-hidden>
        {styles.icon}
      </span>
      <div className="min-w-0 flex-1 text-base text-neutral-700">
        {title && (
          <p className={cn("font-semibold", styles.title)}>{title}</p>
        )}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
