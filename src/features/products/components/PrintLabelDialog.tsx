"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, FormGrid } from "@/components/ui/FormField";
import { Input, NativeSelect } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  ProductLabel,
  ProductLabelStrip,
  labelBarcodeFit,
} from "@/components/shared/ProductLabel";
import { usePharmacySettings } from "@/features/sales/hooks";
import {
  STICKER_LIMITS,
  STICKER_PRESETS,
  loadLabelSetup,
  normaliseLabelSetup,
  saveLabelSetup,
  type LabelSetup,
} from "@/lib/labels";
import { printLabels } from "@/lib/print";
import type { Product } from "@/types/domain";

const MAX_COPIES = 60;
const ROLL = "roll";
const CUSTOM = "custom";

const presetValue = (widthMm: number, heightMm: number) => `${widthMm}x${heightMm}`;

/**
 * Prints labels for one product.
 *
 * The preview is the same component that prints, at the same size, so what is
 * on screen is what comes off the printer — there is no second layout to keep
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
  // The stock describes this till's printer, so it is remembered on this
  // machine. `draft` keeps a half-typed custom size as typed; `setup` is the
  // usable version everything else reads.
  const [draft, setDraft] = useState<LabelSetup>(loadLabelSetup);
  const [customising, setCustomising] = useState(false);
  const settings = usePharmacySettings();

  const setup = normaliseLabelSetup(draft);
  const clamped = Math.min(Math.max(copies || 1, 1), MAX_COPIES);
  const fit = labelBarcodeFit(product, setup);
  const sticker = setup.kind === "STICKER";

  const preset = STICKER_PRESETS.find(
    (size) => size.widthMm === setup.widthMm && size.heightMm === setup.heightMm,
  );
  const stockValue = !sticker
    ? ROLL
    : preset && !customising
      ? presetValue(preset.widthMm, preset.heightMm)
      : CUSTOM;

  function update(next: LabelSetup) {
    setDraft(next);
    saveLabelSetup(normaliseLabelSetup(next));
  }

  function chooseStock(value: string) {
    setCustomising(value === CUSTOM);
    if (value === ROLL) return update({ ...setup, kind: "ROLL" });
    if (value === CUSTOM) return update({ ...setup, kind: "STICKER" });

    const chosen = STICKER_PRESETS.find(
      (size) => presetValue(size.widthMm, size.heightMm) === value,
    );
    if (chosen) update({ ...setup, kind: "STICKER", ...chosen });
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Print labels"
        description={product.name}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Printer className="size-4" />}
              onClick={() => printLabels(setup)}
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

          {fit && !fit.fits && (
            <Alert tone="warning" title="The barcode is too long for this label">
              It needs about {Math.ceil(fit.widthMm + 2)}mm of width to scan
              reliably. Choose a wider label.
            </Alert>
          )}

          <FormGrid columns={2}>
            <FormField
              label="Label stock"
              hint="Measure one sticker, not counting the gap."
            >
              {(ids) => (
                <NativeSelect
                  {...ids}
                  value={stockValue}
                  onChange={(event) => chooseStock(event.target.value)}
                >
                  {STICKER_PRESETS.map((size) => (
                    <option
                      key={presetValue(size.widthMm, size.heightMm)}
                      value={presetValue(size.widthMm, size.heightMm)}
                    >
                      {size.widthMm} × {size.heightMm} mm stickers
                    </option>
                  ))}
                  <option value={CUSTOM}>Other sticker size…</option>
                  <option value={ROLL}>Receipt roll (no stickers)</option>
                </NativeSelect>
              )}
            </FormField>

            <FormField
              label="Printer resolution"
              hint="Most thermal printers are 203 dpi."
            >
              {(ids) => (
                <NativeSelect
                  {...ids}
                  value={String(setup.dpi)}
                  onChange={(event) =>
                    update({ ...setup, dpi: event.target.value === "300" ? 300 : 203 })
                  }
                >
                  <option value="203">203 dpi</option>
                  <option value="300">300 dpi</option>
                </NativeSelect>
              )}
            </FormField>

            {stockValue === CUSTOM && (
              <>
                <FormField label="Sticker width (mm)">
                  {(ids) => (
                    <Input
                      {...ids}
                      type="number"
                      min={STICKER_LIMITS.minWidthMm}
                      max={STICKER_LIMITS.maxWidthMm}
                      step={0.5}
                      value={Number.isFinite(draft.widthMm) ? draft.widthMm : ""}
                      onChange={(event) =>
                        update({
                          ...draft,
                          kind: "STICKER",
                          widthMm: event.target.valueAsNumber,
                        })
                      }
                    />
                  )}
                </FormField>
                <FormField label="Sticker height (mm)">
                  {(ids) => (
                    <Input
                      {...ids}
                      type="number"
                      min={STICKER_LIMITS.minHeightMm}
                      max={STICKER_LIMITS.maxHeightMm}
                      step={0.5}
                      value={Number.isFinite(draft.heightMm) ? draft.heightMm : ""}
                      onChange={(event) =>
                        update({
                          ...draft,
                          kind: "STICKER",
                          heightMm: event.target.valueAsNumber,
                        })
                      }
                    />
                  )}
                </FormField>
              </>
            )}

            <FormField
              label="Copies"
              hint={
                sticker
                  ? `One label per sticker. Up to ${MAX_COPIES}.`
                  : `End to end on the roll, with a cut line between each. Up to ${MAX_COPIES}.`
              }
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
          </FormGrid>

          {sticker && (
            <p className="text-meta text-text-muted">
              In the print window, choose the label printer, set the paper size
              to {setup.widthMm} × {setup.heightMm} mm and leave the scale at
              Default. If that size is not listed, add it under the printer&apos;s
              Printing Preferences.
            </p>
          )}

          <div>
            <p className="text-micro font-semibold uppercase tracking-wide text-text-muted">
              Preview · actual size
            </p>
            <div className="mt-2 flex justify-center rounded-md border border-border bg-canvas p-3">
              <div className="ring-1 ring-neutral-300">
                <ProductLabel product={product} settings={settings.data} setup={setup} />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/*
        Rendered beside the dialog, never inside it, and only while it is open
        so nothing invisible is left in the tree. The strip portals itself to
        <body>.
      */}
      {open && (
        <ProductLabelStrip
          product={product}
          copies={clamped}
          settings={settings.data}
          setup={setup}
        />
      )}
    </>
  );
}
