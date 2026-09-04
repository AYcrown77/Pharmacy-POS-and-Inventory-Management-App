"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { ReceiptDocument } from "@/components/shared/ReceiptDocument";
import { Alert } from "@/components/ui/Alert";
import { KeyHint } from "@/components/ui/Tooltip";
import { usePharmacySettings } from "@/features/sales/hooks";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useTerminal } from "@/hooks/useTerminal";
import { toErrorMessage } from "@/lib/api/http";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatQuantity } from "@/lib/money";
import { printReceipt } from "@/lib/print";
import { STOCK_AFFECTING_KEYS, salesKeys } from "@/lib/query/keys";
import { productsService, type SaleLookup } from "@/services/products.service";
import { salesService } from "@/services/sales.service";
import type { Money } from "@/types/common";
import type { PaymentMethod, Sale } from "@/types/domain";
import { CartTable } from "./components/CartTable";
import { CompleteSaleDialog } from "./components/CompleteSaleDialog";
import { OrderPanel } from "./components/OrderPanel";
import { SaleSuccessDialog } from "./components/SaleSuccessDialog";
import { ScanBar } from "./components/ScanBar";
import { usePosCart } from "./usePosCart";

/** Everything that can go wrong between scanning and adding to the cart. */
type ScanNotice =
  | { kind: "NOT_FOUND"; query: string }
  | { kind: "OUT_OF_STOCK"; productName: string }
  | { kind: "EXPIRED_ONLY"; productName: string }
  | { kind: "AT_CEILING"; productName: string; available: number };

export function PosTerminal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { terminal } = useTerminal();
  const cart = usePosCart();
  const settings = usePharmacySettings();

  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<ScanNotice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [payingOpen, setPayingOpen] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  const scanRef = useRef<HTMLInputElement>(null);

  const focusScan = useCallback(() => {
    scanRef.current?.focus();
    scanRef.current?.select();
  }, []);

  // The till is ready to scan the moment it opens — a cashier should never
  // have to click into the box first.
  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  /* ---------------------------------------------------------------------
     Adding to the cart
     --------------------------------------------------------------------- */

  const lookup = useMutation({
    mutationFn: (idOrBarcode: string) =>
      productsService.lookupForSale(idOrBarcode),
  });

  const addToCart = useCallback(
    async (idOrBarcode: string) => {
      setNotice(null);

      let result: SaleLookup | null;
      try {
        result = await lookup.mutateAsync(idOrBarcode);
      } catch (error) {
        setNotice({ kind: "NOT_FOUND", query: idOrBarcode });
        console.error("Product lookup failed:", error);
        return;
      }

      if (!result) {
        setNotice({ kind: "NOT_FOUND", query: idOrBarcode });
        return;
      }

      // Stock exists but every batch has expired — a distinct problem from
      // having none, and the cashier needs to know which it is.
      if (result.expiredOnly) {
        setNotice({
          kind: "EXPIRED_ONLY",
          productName: result.product.name,
        });
        return;
      }

      if (result.availableStock <= 0) {
        setNotice({
          kind: "OUT_OF_STOCK",
          productName: result.product.name,
        });
        return;
      }

      // Already holding everything on the shelf.
      const existing = cart.state.lines.find(
        (line) => line.productId === result.product.id,
      );
      if (existing && existing.quantity >= result.availableStock) {
        setNotice({
          kind: "AT_CEILING",
          productName: result.product.name,
          available: result.availableStock,
        });
        return;
      }

      cart.dispatch({ type: "ADD", lookup: result });
      setQuery("");
      focusScan();
    },
    [cart, lookup, focusScan],
  );

  /* ---------------------------------------------------------------------
     Completing the sale
     --------------------------------------------------------------------- */

  const complete = useMutation({
    mutationFn: (amountReceived: Money | null) =>
      salesService.complete({
        lines: cart.state.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        discount: cart.state.discount,
        paymentMethod,
        amountReceived,
        cashierId: user?.id ?? "",
        terminalId: terminal.id,
      }),
    onSuccess: (sale) => {
      for (const key of STOCK_AFFECTING_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({ queryKey: salesKeys.all });

      setPayingOpen(false);
      setSaleError(null);
      setCompletedSale(sale);
      cart.dispatch({ type: "CLEAR" });
    },
    onError: (error) => {
      // The cart is deliberately left intact. Another till may have taken the
      // last pack between scanning and paying; the cashier needs to see what
      // they built, fix the offending line, and try again.
      setSaleError(toErrorMessage(error));
    },
  });

  function startNewSale() {
    setCompletedSale(null);
    setSaleError(null);
    setQuery("");
    setNotice(null);
    setPaymentMethod("CASH");
    focusScan();
  }

  const busy = complete.isPending;
  const dialogOpen = payingOpen || Boolean(completedSale);

  /* ---------------------------------------------------------------------
     Keyboard
     --------------------------------------------------------------------- */

  useHotkeys(
    {
      F2: () => focusScan(),
      F4: () => setPaymentMethod("CASH"),
      F6: () => setPaymentMethod("CARD"),
      F8: () => setPaymentMethod("TRANSFER"),
      F9: () => {
        if (!cart.isEmpty && !busy) setPayingOpen(true);
      },
      Escape: () => {
        if (query) {
          setQuery("");
          return;
        }
        setNotice(null);
      },
    },
    // Shortcuts stand down while a dialog owns the keyboard.
    { enabled: !dialogOpen },
  );

  /**
   * Type-ahead: a scanner fires its keystrokes wherever focus happens to be.
   * If that is not a field, pull focus to the scan box so the barcode lands
   * there instead of being swallowed. Focusing during keydown means the
   * character still reaches the input.
   */
  useEffect(() => {
    if (dialogOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key.length !== 1) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      scanRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen]);

  return (
    <div className="flex h-full min-h-0">
      {/* The till has no visible page title — the scan box is the first thing
          that should meet the eye — but it still needs one heading so screen
          reader users can identify the screen they landed on. */}
      <h1 className="sr-only">Point of sale</h1>

      <div className="flex min-w-0 flex-1 flex-col">
        <ScanBar
          ref={scanRef}
          value={query}
          onValueChange={setQuery}
          onSubmitBarcode={(barcode) => void addToCart(barcode)}
          onSelectProduct={(productId) => void addToCart(productId)}
          busy={lookup.isPending}
          disabled={busy}
        />

        {notice && (
          <div className="shrink-0 px-4 pt-3">
            <ScanNoticeAlert
              notice={notice}
              onDismiss={() => {
                setNotice(null);
                focusScan();
              }}
            />
          </div>
        )}

        <CartTable
          lines={cart.state.lines}
          lastTouchedProductId={cart.state.lastTouchedProductId}
          onAdjustQuantity={(productId, delta) =>
            cart.dispatch({ type: "ADJUST_QUANTITY", productId, delta })
          }
          onSetQuantity={(productId, quantity) =>
            cart.dispatch({ type: "SET_QUANTITY", productId, quantity })
          }
          onRemove={(productId) =>
            cart.dispatch({ type: "REMOVE", productId })
          }
          onFocusScan={focusScan}
          disabled={busy}
        />

        <div className="flex shrink-0 items-center gap-4 border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-micro text-neutral-500">
          <Hint keys="F2" label="Search" />
          <Hint keys="F4 / F6 / F8" label="Payment" />
          <Hint keys="F9" label="Complete sale" />
          <Hint keys="Esc" label="Clear search" />
          <span className="num ml-auto">
            {terminal.shortName} · {user?.name}
          </span>
        </div>
      </div>

      <OrderPanel
        itemCount={cart.itemCount}
        subtotal={cart.subtotal}
        discount={cart.state.discount}
        total={cart.total}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        onClear={() => {
          cart.dispatch({ type: "CLEAR" });
          focusScan();
        }}
        onComplete={() => setPayingOpen(true)}
        canComplete={!cart.isEmpty && !busy}
        processing={busy}
      />

      <CompleteSaleDialog
        // Remounts on each open so the amount-received field starts empty.
        key={payingOpen ? "paying" : "idle"}
        open={payingOpen}
        onOpenChange={(open) => {
          setPayingOpen(open);
          if (!open) {
            setSaleError(null);
            focusScan();
          }
        }}
        total={cart.total}
        itemCount={cart.itemCount}
        paymentMethod={paymentMethod}
        processing={busy}
        error={saleError}
        onConfirm={(amountReceived) => complete.mutate(amountReceived)}
      />

      <SaleSuccessDialog
        sale={completedSale}
        onNewSale={startNewSale}
        onPrint={printReceipt}
      />

      {/* Mounted off-screen once a sale exists, so Print Receipt has
          something to send to the thermal printer. */}
      {completedSale && (
        <ReceiptDocument sale={completedSale} settings={settings.data} />
      )}
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <KeyHint>{keys}</KeyHint>
      {label}
    </span>
  );
}

function ScanNoticeAlert({
  notice,
  onDismiss,
}: {
  notice: ScanNotice;
  onDismiss: () => void;
}) {
  const content = {
    NOT_FOUND: {
      tone: "warning" as const,
      title: "Product not found",
      body:
        notice.kind === "NOT_FOUND"
          ? `Nothing matches "${notice.query}". Check the barcode, or search by name.`
          : "",
    },
    OUT_OF_STOCK: {
      tone: "danger" as const,
      title: "Out of stock",
      body:
        notice.kind === "OUT_OF_STOCK"
          ? `${notice.productName} has no stock available and cannot be sold.`
          : "",
    },
    EXPIRED_ONLY: {
      tone: "danger" as const,
      title: "Only expired stock remains",
      body:
        notice.kind === "EXPIRED_ONLY"
          ? `Every batch of ${notice.productName} has passed its expiry date. It cannot be sold — record a stock adjustment to write it off.`
          : "",
    },
    AT_CEILING: {
      tone: "warning" as const,
      title: "No more available",
      body:
        notice.kind === "AT_CEILING"
          ? `The cart already holds all ${formatQuantity(notice.available)} available units of ${notice.productName}.`
          : "",
    },
  }[notice.kind];

  return (
    <Alert
      tone={content.tone}
      title={content.title}
      action={
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-2 py-1 text-meta font-medium text-neutral-600 hover:bg-white/60"
        >
          Dismiss
        </button>
      }
    >
      {content.body}
    </Alert>
  );
}
