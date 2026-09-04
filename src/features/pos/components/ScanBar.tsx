"use client";

import { useQuery } from "@tanstack/react-query";
import { ScanBarcode, Search } from "lucide-react";
import { forwardRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { useDebounce } from "@/hooks/useDebounce";
import { productKeys } from "@/lib/query/keys";
import { formatMoney, formatQuantity } from "@/lib/money";
import { productsService } from "@/services/products.service";
import { KeyHint } from "@/components/ui/Tooltip";
import { Spinner } from "@/components/ui/Spinner";

/**
 * A barcode scanner is a keyboard: it types the code fast and sends Enter.
 * So one input serves both scanning and typing, and the two are told apart
 * by what was entered rather than by any mode the cashier has to set.
 */

/** Barcodes are all digits and at least eight long; product names are not. */
export function looksLikeBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}

export interface ScanBarProps {
  value: string;
  onValueChange: (value: string) => void;
  /** A barcode was entered, or a search result chosen. */
  onSubmitBarcode: (barcode: string) => void;
  onSelectProduct: (productId: string) => void;
  disabled?: boolean;
  busy?: boolean;
}

export const ScanBar = forwardRef<HTMLInputElement, ScanBarProps>(
  function ScanBar(
    { value, onValueChange, onSubmitBarcode, onSelectProduct, disabled, busy },
    ref,
  ) {
    const [activeIndex, setActiveIndex] = useState(0);

    const term = value.trim();
    const isBarcode = looksLikeBarcode(term);
    const debounced = useDebounce(term, 200);

    // A barcode never needs a text search — it is resolved on Enter.
    const { data: results, isFetching } = useQuery({
      queryKey: productKeys.search(debounced),
      queryFn: () => productsService.search(debounced, 7),
      enabled: debounced.length >= 2 && !looksLikeBarcode(debounced),
      staleTime: 30_000,
    });

    const options = results ?? [];
    const showResults = options.length > 0 && !isBarcode;

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (!term) return;

        // A scanner's trailing Enter lands here.
        if (isBarcode) {
          onSubmitBarcode(term);
          return;
        }
        if (showResults) onSelectProduct(options[activeIndex].id);
        return;
      }

      // Some scanners send Tab instead of Enter.
      if (event.key === "Tab" && isBarcode && term) {
        event.preventDefault();
        onSubmitBarcode(term);
        return;
      }

      if (!showResults) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + options.length) % options.length);
      }
    }

    return (
      <div className="relative border-b border-neutral-200 bg-white px-4 py-3">
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center"
            aria-hidden
          >
            {busy || isFetching ? (
              <Spinner className="size-5" />
            ) : isBarcode ? (
              <ScanBarcode className="size-5 text-primary-600" />
            ) : (
              <Search className="size-5 text-neutral-400" />
            )}
          </span>

          <input
            ref={ref}
            type="text"
            role="combobox"
            aria-expanded={showResults}
            aria-controls="pos-search-results"
            aria-autocomplete="list"
            aria-label="Scan barcode or search for a product"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={disabled}
            value={value}
            placeholder="Scan barcode or search by name, generic or brand"
            onChange={(event) => {
              onValueChange(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            className={cn(
              "h-control-lg w-full rounded-md bg-white pl-11 pr-16 text-section text-neutral-900",
              "ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400",
              "focus:outline-none focus:ring-2 focus:ring-primary-500",
              "disabled:cursor-not-allowed disabled:bg-neutral-50",
            )}
          />

          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <KeyHint>F2</KeyHint>
          </span>
        </div>

        {showResults && (
          <ul
            id="pos-search-results"
            role="listbox"
            aria-label="Search results"
            className="absolute inset-x-4 z-30 mt-1 max-h-80 overflow-y-auto rounded-md bg-white py-1 shadow-overlay"
          >
            {options.map((product, index) => {
              const outOfStock = product.availableStock <= 0;

              return (
                <li
                  key={product.id}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => onSelectProduct(product.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left",
                      index === activeIndex && "bg-primary-50",
                      outOfStock && "opacity-60",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-neutral-900">
                        {product.name}
                      </span>
                      <span className="block truncate text-meta text-neutral-500">
                        {[
                          product.genericName,
                          product.brandName,
                          product.barcode,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>

                    <span className="num shrink-0 text-right">
                      <span className="block text-base font-semibold text-neutral-900">
                        {formatMoney(product.sellingPrice)}
                      </span>
                      <span
                        className={cn(
                          "block text-meta",
                          outOfStock
                            ? "font-medium text-danger-600"
                            : "text-neutral-500",
                        )}
                      >
                        {outOfStock
                          ? "Out of stock"
                          : `${formatQuantity(product.availableStock)} available`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  },
);
