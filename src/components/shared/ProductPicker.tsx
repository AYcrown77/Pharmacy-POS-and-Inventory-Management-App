"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Package, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useDebounce } from "@/hooks/useDebounce";
import { productKeys } from "@/lib/query/keys";
import { formatMoney, formatQuantity } from "@/lib/money";
import { STOCK_STATUS_LABELS, STOCK_STATUS_TONES } from "@/lib/status";
import {
  productsService,
  type ProductListItem,
} from "@/services/products.service";
import type { Product } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

/**
 * The picker accepts either a full list item (from search, carrying stock
 * figures) or a bare product (fetched by id when the page is deep-linked).
 * The stock summary is shown when it is available.
 */
export type PickerProduct = Product &
  Partial<Pick<ProductListItem, "availableStock" | "stockStatus">>;

/**
 * Searchable product selector.
 *
 * Deliberately a search box rather than a `<select>`: a pharmacy catalogue
 * runs to thousands of lines, and staff know the medicine by name, generic or
 * barcode — not by its position in a list.
 *
 * Once a product is chosen the search collapses into a summary card showing
 * current stock, which is the context needed when receiving or adjusting.
 */
export function ProductPicker({
  value,
  onChange,
  id,
  invalid,
  describedBy,
  disabled,
  autoFocus,
}: {
  value: PickerProduct | null;
  onChange: (product: PickerProduct | null) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const debounced = useDebounce(term, 200);

  const { data: results, isFetching } = useQuery({
    queryKey: productKeys.search(debounced),
    queryFn: () => productsService.search(debounced, 8),
    enabled: debounced.trim().length > 0 && !value,
    staleTime: 30_000,
  });

  // Close the results when focus leaves the picker entirely.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const options = results ?? [];

  function select(product: PickerProduct) {
    onChange(product);
    setTerm("");
    setOpen(false);
  }

  if (value) {
    return (
      <SelectedProduct
        product={value}
        onClear={disabled ? undefined : () => onChange(null)}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        aria-describedby={describedBy}
        invalid={invalid}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        value={term}
        placeholder="Search by name, generic, brand or barcode"
        leadingIcon={
          isFetching ? <Spinner className="size-4" /> : <Search className="size-4" />
        }
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!open || options.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % options.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(
              (index) => (index - 1 + options.length) % options.length,
            );
          } else if (event.key === "Enter") {
            event.preventDefault();
            select(options[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {open && debounced.trim().length > 0 && (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md bg-white py-1 shadow-overlay"
        >
          {options.length === 0 && !isFetching && (
            <li className="px-3 py-6 text-center text-base text-neutral-500">
              No product matches &ldquo;{debounced}&rdquo;
            </li>
          )}

          {options.map((product, index) => (
            <li key={product.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onClick={() => select(product)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left",
                  index === activeIndex && "bg-primary-50",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-neutral-900">
                    {product.name}
                  </span>
                  <span className="block truncate text-meta text-neutral-500">
                    {[product.genericName, product.brandName, product.barcode]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>

                <span className="num shrink-0 text-right text-meta">
                  <span className="block font-medium text-neutral-800">
                    {formatQuantity(product.availableStock)} in stock
                  </span>
                  <span className="block text-neutral-500">
                    {formatMoney(product.sellingPrice)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SelectedProduct({
  product,
  onClear,
}: {
  product: PickerProduct;
  onClear?: () => void;
}) {
  const { availableStock, stockStatus } = product;

  return (
    <div className="flex items-center gap-3 rounded-md bg-neutral-50 px-3 py-2.5 ring-1 ring-inset ring-neutral-200">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-primary-700 ring-1 ring-inset ring-neutral-200"
        aria-hidden
      >
        <Package className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-medium text-neutral-900">
            {product.name}
          </span>
          <Check className="size-3.5 shrink-0 text-success-600" aria-hidden />
        </span>
        <span className="block truncate text-meta text-neutral-500">
          {[product.genericName, product.strength, product.category?.name]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>

      {availableStock !== undefined && (
        <span className="num shrink-0 text-right text-meta">
          <span className="block font-medium text-neutral-800">
            {formatQuantity(availableStock)} in stock
          </span>
          {stockStatus && (
            <Badge tone={STOCK_STATUS_TONES[stockStatus]} size="sm">
              {STOCK_STATUS_LABELS[stockStatus]}
            </Badge>
          )}
        </span>
      )}

      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Change product, currently ${product.name}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
