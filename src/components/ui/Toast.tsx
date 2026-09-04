"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

/**
 * A small toast system, hand-built rather than pulled from a dependency.
 * Toasts are announced politely, dismiss on a timer, and pause nothing —
 * they never block the till.
 */

export type ToastTone = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { ...input, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DEFAULT_DURATION_MS),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const TONE_STYLES: Record<ToastTone, { ring: string; icon: ReactNode }> = {
  success: {
    ring: "ring-success-200",
    icon: <CheckCircle2 className="size-4 text-success-600" />,
  },
  error: {
    ring: "ring-danger-200",
    icon: <XCircle className="size-4 text-danger-600" />,
  },
  warning: {
    ring: "ring-warning-200",
    icon: <AlertTriangle className="size-4 text-warning-600" />,
  },
  info: {
    ring: "ring-info-200",
    icon: <Info className="size-4 text-info-600" />,
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      data-print-hidden
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          aria-live={item.tone === "error" ? "assertive" : "polite"}
          className={cn(
            "pointer-events-auto flex items-start gap-2.5 rounded-lg bg-white px-3.5 py-3 shadow-overlay ring-1",
            TONE_STYLES[item.tone].ring,
          )}
        >
          <span className="mt-px shrink-0" aria-hidden>
            {TONE_STYLES[item.tone].icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-neutral-900">
              {item.title}
            </p>
            {item.description && (
              <p className="mt-0.5 text-meta text-neutral-600">
                {item.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            aria-label="Dismiss notification"
            className="-mr-1 -mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
