"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { ProductLabel, ProductLabelStrip } from "@/components/shared/ProductLabel";
import { printLabels } from "@/lib/print";
import { usePharmacySettings } from "@/features/sales/hooks";
import type { Product } from "@/types/domain";

const MAX_COPIES = 60;

/**
 * Prints a strip of shelf labels for one product.
 *
 * The preview is the same component that prints, at the same width, so what
 * is on screen is what comes off the roll — there is no second layout to keep
 * in step.
 */
export function PrintLabelDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copies, setCopies] = useState(1);
  const settings = usePharmacySettings();

  const clamped = Math.min(Math.max(copies || 1, 1), MAX_COPIES);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Print labels"
      description={product.name}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leadingIcon={<Printer className="size-4" />}
            onClick={() => printLabels()}
          >
            Print {clamped} label{clamped === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!product.barcode && (
          <Alert tone="warning" title="This product has no barcode">
            The label will print without one, so it cannot be scanned at the
            till. Add a barcode to the product first if you need that.
          </Alert>
        )}

        <FormField
          label="Copies"
          hint={`Prints end to end on the roll, with a cut line between each. Up to ${MAX_COPIES}.`}
        >
          {(ids) => (
            <Input
              {...ids}
              type="number"
              min={1}
              max={MAX_COPIES}
              value={copies}
              onChange={(event) => setCopies(Number(event.target.value))}
            />
          )}
        </FormField>

        <div>
          <p className="text-micro font-semibold uppercase tracking-wide text-text-muted">
            Preview · actual size
          </p>
          <div className="mt-2 flex justify-center rounded-md border border-border bg-canvas p-3">
            <ProductLabel product={product} settings={settings.data} />
          </div>
        </div>
      </div>

      {/* Off-screen, and the only thing the print stylesheet reveals. */}
      <div className="pointer-events-none fixed left-[-200vw] top-0">
        <ProductLabelStrip
          product={product}
          copies={clamped}
          settings={settings.data}
        />
      </div>
    </Modal>
  );
}
