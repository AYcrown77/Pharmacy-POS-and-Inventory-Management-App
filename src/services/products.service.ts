/**
 * Products and categories.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { ApiError, http } from "@/lib/api/http";
import {
  availableStock,
  batchesForProduct,
  db,
  recordAudit,
  sellableBatches,
} from "@/mocks/db";
import { matchesSearch, mockRequest, paginate, sortBy } from "@/mocks/latency";
import type { DateOnly, ListParams, Money, Paginated } from "@/types/common";
import type {
  Category,
  DosageForm,
  Product,
  StockStatus,
  UnitType,
} from "@/types/domain";
import { deriveStockStatus } from "@/lib/status";

export interface ProductFilters extends ListParams {
  categoryId?: string;
  stockStatus?: StockStatus;
  isActive?: boolean;
}

export interface ProductInput {
  name: string;
  genericName: string | null;
  brandName: string | null;
  barcode: string | null;
  categoryId: string;
  strength: string | null;
  dosageForm: DosageForm | null;
  priceWholesale: Money;
  priceRetail: Money;
  priceConsumer: Money;
  unitsPerPack: number;
  minimumStockLevel: number;
  unitType: UnitType;
  isActive: boolean;
}

/** A product plus the stock figures the list view needs — one round trip. */
export interface ProductListItem extends Product {
  availableStock: number;
  stockStatus: StockStatus;
}

/** The batch a sale would draw from, for display at the till. */
export interface SellableBatch {
  batchId: string;
  batchNumber: string;
  expiryDate: DateOnly;
  quantityRemaining: number;
}

/**
 * Everything the till needs about one product, in a single call.
 *
 * `expiredOnly` is the reason this exists as its own endpoint: a product can
 * have stock on the shelf and still be unsellable because every batch has
 * passed its expiry date, and the cashier needs to be told exactly that
 * rather than a bare "out of stock".
 */
export interface SaleLookup {
  product: ProductListItem;
  availableStock: number;
  /** Earliest expiry first — the order FEFO will consume them in. */
  sellableBatches: SellableBatch[];
  expiredOnly: boolean;
}

export interface ProductsService {
  list(filters?: ProductFilters): Promise<Paginated<ProductListItem>>;
  getById(id: string): Promise<Product>;
  getByBarcode(barcode: string): Promise<Product | null>;
  /** Fast lookup for the POS search box. */
  search(term: string, limit?: number): Promise<ProductListItem[]>;
  /** Resolve a product id or barcode to everything the till needs. */
  lookupForSale(idOrBarcode: string): Promise<SaleLookup | null>;
  create(input: ProductInput, userId: string): Promise<Product>;
  update(id: string, input: ProductInput, userId: string): Promise<Product>;
  listCategories(): Promise<Category[]>;
  /** Creates a category typed on the fly while adding a product. */
  createCategory(name: string): Promise<Category>;
}

/* -------------------------------------------------------------------------
   Mock adapter
   ------------------------------------------------------------------------- */

function toListItem(product: Product): ProductListItem {
  const available = availableStock(product.id);
  return {
    ...product,
    availableStock: available,
    stockStatus: deriveStockStatus(available, product.minimumStockLevel),
  };
}

function applyProductSort(
  items: ProductListItem[],
  filters: ProductFilters,
): ProductListItem[] {
  const direction = filters.sortDir ?? "asc";
  switch (filters.sortBy) {
    case "sellingPrice":
      // "Price" in the list means the walk-in price, which is what it shows.
      return sortBy(items, (item) => item.priceConsumer, direction);
    case "availableStock":
      return sortBy(items, (item) => item.availableStock, direction);
    case "category":
      return sortBy(items, (item) => item.category?.name ?? null, direction);
    case "createdAt":
      return sortBy(items, (item) => item.createdAt, direction);
    default:
      return sortBy(items, (item) => item.name, direction);
  }
}

const mockProductsService: ProductsService = {
  list: (filters = {}) =>
    mockRequest(() => {
      let items = db.products.map(toListItem);

      items = items.filter(
        (item) =>
          matchesSearch(
            filters.search,
            item.name,
            item.genericName,
            item.brandName,
            item.barcode,
          ) &&
          (!filters.categoryId || item.categoryId === filters.categoryId) &&
          (!filters.stockStatus || item.stockStatus === filters.stockStatus) &&
          (filters.isActive === undefined || item.isActive === filters.isActive),
      );

      return paginate(applyProductSort(items, filters), filters);
    }),

  getById: (id) =>
    mockRequest(() => {
      const product = db.products.find((item) => item.id === id);
      if (!product) throw new ApiError(404, "Product not found.");
      return product;
    }),

  getByBarcode: (barcode) =>
    mockRequest(() => {
      const normalised = barcode.trim();
      return (
        db.products.find(
          (item) => item.isActive && item.barcode === normalised,
        ) ?? null
      );
    }),

  search: (term, limit = 12) =>
    mockRequest(() => {
      const query = term.trim();
      if (!query) return [];

      const matches = db.products.filter(
        (product) =>
          product.isActive &&
          matchesSearch(
            query,
            product.name,
            product.genericName,
            product.brandName,
            product.barcode,
          ),
      );

      // An exact barcode hit should always lead, however the list sorts.
      const ranked = sortBy(matches, (product) => {
        if (product.barcode === query) return `0-${product.name}`;
        if (product.name.toLowerCase().startsWith(query.toLowerCase())) {
          return `1-${product.name}`;
        }
        return `2-${product.name}`;
      });

      return ranked.slice(0, limit).map(toListItem);
    }),

  lookupForSale: (idOrBarcode) =>
    mockRequest(() => {
      const needle = idOrBarcode.trim();
      const product = db.products.find(
        (item) =>
          item.isActive && (item.id === needle || item.barcode === needle),
      );
      if (!product) return null;

      const all = batchesForProduct(product.id);
      const sellable = sellableBatches(product.id);
      const hasAnyStock = all.some((batch) => batch.quantityRemaining > 0);

      return {
        product: toListItem(product),
        availableStock: sellable.reduce(
          (total, batch) => total + batch.quantityRemaining,
          0,
        ),
        sellableBatches: sellable.map((batch) => ({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          quantityRemaining: batch.quantityRemaining,
        })),
        // Stock is on the shelf, but all of it has expired.
        expiredOnly: hasAnyStock && sellable.length === 0,
      } satisfies SaleLookup;
    }),

  create: (input, userId) =>
    mockRequest(() => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) throw new ApiError(401, "Your session has expired.");

      if (input.barcode) {
        const clash = db.products.find(
          (item) => item.barcode === input.barcode,
        );
        if (clash) {
          throw new ApiError(
            409,
            `Barcode ${input.barcode} is already used by ${clash.name}.`,
            "DUPLICATE_BARCODE",
          );
        }
      }

      const now = new Date().toISOString();
      const product: Product = {
        id: `prd-${Date.now().toString(36)}`,
        ...input,
        category:
          db.categories.find((item) => item.id === input.categoryId) ?? null,
        createdAt: now,
        updatedAt: now,
      };

      db.products.push(product);

      recordAudit({
        userId: user.id,
        userName: user.name,
        action: "PRODUCT_CREATED",
        entityType: "PRODUCT",
        entityId: product.id,
        newValue: {
          name: product.name,
          priceWholesale: product.priceWholesale,
          priceRetail: product.priceRetail,
          priceConsumer: product.priceConsumer,
        },
      });

      return product;
    }),

  update: (id, input, userId) =>
    mockRequest(() => {
      const product = db.products.find((item) => item.id === id);
      if (!product) throw new ApiError(404, "Product not found.");

      const user = db.users.find((item) => item.id === userId);
      if (!user) throw new ApiError(401, "Your session has expired.");

      if (input.barcode) {
        const clash = db.products.find(
          (item) => item.barcode === input.barcode && item.id !== id,
        );
        if (clash) {
          throw new ApiError(
            409,
            `Barcode ${input.barcode} is already used by ${clash.name}.`,
            "DUPLICATE_BARCODE",
          );
        }
      }

      const previousPrices = {
        priceWholesale: product.priceWholesale,
        priceRetail: product.priceRetail,
        priceConsumer: product.priceConsumer,
      };

      Object.assign(product, input, {
        category:
          db.categories.find((item) => item.id === input.categoryId) ?? null,
        updatedAt: new Date().toISOString(),
      });

      recordAudit({
        userId: user.id,
        userName: user.name,
        action: "PRODUCT_UPDATED",
        entityType: "PRODUCT",
        entityId: product.id,
        newValue: { name: product.name },
      });

      // A price change is separately tracked — §24 lists it as its own action.
      const pricesChanged =
        previousPrices.priceWholesale !== input.priceWholesale ||
        previousPrices.priceRetail !== input.priceRetail ||
        previousPrices.priceConsumer !== input.priceConsumer;

      if (pricesChanged) {
        recordAudit({
          userId: user.id,
          userName: user.name,
          action: "PRICE_CHANGED",
          entityType: "PRODUCT",
          entityId: product.id,
          oldValue: previousPrices,
          newValue: {
            priceWholesale: input.priceWholesale,
            priceRetail: input.priceRetail,
            priceConsumer: input.priceConsumer,
          },
        });
      }

      return product;
    }),

  listCategories: () => mockRequest(() => [...db.categories]),

  createCategory: (name) =>
    mockRequest(() => {
      const trimmed = name.trim();
      const existing = db.categories.find(
        (item) => item.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;

      const category: Category = {
        id: `cat-${Date.now().toString(36)}`,
        name: trimmed,
        description: null,
      };
      db.categories.push(category);
      return category;
    }),
};

/* -------------------------------------------------------------------------
   HTTP adapter
   ------------------------------------------------------------------------- */

const httpProductsService: ProductsService = {
  list: (filters) =>
    http.get<Paginated<ProductListItem>>("/products", { params: filters }),
  getById: (id) => http.get<Product>(`/products/${id}`),
  getByBarcode: (barcode) =>
    http.get<Product | null>(`/products/barcode/${encodeURIComponent(barcode)}`),
  search: (term, limit) =>
    http.get<ProductListItem[]>("/products/search", {
      params: { q: term, limit },
    }),
  lookupForSale: (idOrBarcode) =>
    http.get<SaleLookup | null>(
      `/products/sale-lookup/${encodeURIComponent(idOrBarcode)}`,
    ),
  create: (input) => http.post<Product>("/products", input),
  update: (id, input) => http.patch<Product>(`/products/${id}`, input),
  listCategories: () => http.get<Category[]>("/categories"),
  createCategory: (name) =>
    http.post<Category>("/categories", { name, description: null }),
};

export const productsService: ProductsService = USE_MOCKS
  ? mockProductsService
  : httpProductsService;
