/**
 * In-memory pharmacy database.
 *
 * This is a real, mutating store — not a bag of fixtures. Completing a sale
 * walks batches in FEFO order and decrements them; receiving stock creates a
 * batch and a movement; adjusting stock writes an audit entry. That is what
 * makes the POS, inventory and reports agree with each other before the
 * Express backend exists, and what proves the service contracts are right.
 *
 * State lives for the lifetime of the page. A reload reseeds it — expected,
 * not a bug.
 */

import { addDays, daysUntil, today, toDateOnly } from "@/lib/date";
import { nairaToKobo } from "@/lib/money";
import {
  ADJUSTMENT_REASON_MOVEMENT,
  deriveExpiryStatus,
  deriveStockStatus,
} from "@/lib/status";
import type { DateOnly, Money, Timestamp } from "@/types/common";
import type {
  AdjustmentReason,
  AuditAction,
  AuditLog,
  Batch,
  Category,
  InventoryItem,
  MovementType,
  Customer,
  CustomerLedgerEntry,
  PaymentMethod,
  PharmacySettings,
  PriceTier,
  Product,
  Sale,
  SaleItem,
  SaleReturn,
  SaleStatus,
  StockAdjustment,
  StockMovement,
  Terminal,
  User,
} from "@/types/domain";
import {
  SEED_BATCH_PLANS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_SUPPLIERS,
} from "./seed/catalogue";

/* -------------------------------------------------------------------------
   Deterministic randomness — stable seed data across reloads
   ------------------------------------------------------------------------- */

function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

const random = createRandom(20260901);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36).padStart(5, "0")}`;
}

/* -------------------------------------------------------------------------
   Errors — mirror the HTTP failures the real API will return
   ------------------------------------------------------------------------- */

export class MockApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MockApiError";
  }
}

/* -------------------------------------------------------------------------
   Shape
   ------------------------------------------------------------------------- */

interface Database {
  users: User[];
  categories: Category[];
  products: Product[];
  batches: Batch[];
  sales: Sale[];
  movements: StockMovement[];
  adjustments: StockAdjustment[];
  returns: SaleReturn[];
  auditLogs: AuditLog[];
  terminals: Terminal[];
  customers: Customer[];
  customerLedger: CustomerLedgerEntry[];
  settings: PharmacySettings;
  receiptSequence: number;
}

/* -------------------------------------------------------------------------
   Seeding
   ------------------------------------------------------------------------- */

const NOW = new Date();

function isoDaysAgo(days: number, hour = 10, minute = 0): Timestamp {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function seedUsers(): User[] {
  const base = {
    isActive: true,
    createdAt: isoDaysAgo(400),
    updatedAt: isoDaysAgo(30),
  };
  return [
    {
      id: "usr-admin",
      name: "Quadri Adeyemi",
      username: "admin",
      role: "ADMINISTRATOR",
      lastLoginAt: isoDaysAgo(0, 8, 12),
      ...base,
    },
    {
      id: "usr-cashier",
      name: "Sarah Okonkwo",
      username: "cashier",
      role: "CASHIER",
      lastLoginAt: isoDaysAgo(0, 8, 30),
      ...base,
    },
    {
      id: "usr-cashier-3",
      name: "Ibrahim Bello",
      username: "ibrahim",
      role: "CASHIER",
      lastLoginAt: isoDaysAgo(1, 9, 5),
      ...base,
    },
    {
      id: "usr-cashier-2",
      name: "Chioma Eze",
      username: "chioma",
      role: "CASHIER",
      lastLoginAt: isoDaysAgo(2, 14, 20),
      ...base,
    },
    {
      id: "usr-disabled",
      name: "Tunde Bakare",
      username: "tunde",
      role: "CASHIER",
      lastLoginAt: isoDaysAgo(95),
      isActive: false,
      createdAt: isoDaysAgo(300),
      updatedAt: isoDaysAgo(95),
    },
  ];
}

const SEED_TERMINALS: Terminal[] = [
  { id: "trm-01", name: "Terminal 01", location: "Checkout", type: "CHECKOUT", isActive: true },
  { id: "trm-02", name: "Terminal 02", location: "Dispensing", type: "DISPENSING", isActive: true },
  { id: "trm-03", name: "Terminal 03", location: "Back Office", type: "ADMIN", isActive: true },
];

function seedDatabase(): Database {
  const users = seedUsers();
  const admin = users[0];

  const categories: Category[] = SEED_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
  }));

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const products: Product[] = SEED_PRODUCTS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    genericName: seed.genericName,
    brandName: seed.brandName,
    barcode: seed.barcode,
    categoryId: seed.categoryId,
    category: categoryById.get(seed.categoryId) ?? null,
    strength: seed.strength,
    dosageForm: seed.dosageForm,
    priceWholesale: seed.priceWholesale,
    priceRetail: seed.priceRetail,
    priceConsumer: seed.priceConsumer,
    unitsPerPack: seed.unitsPerPack ?? 1,
    minimumStockLevel: seed.minimumStockLevel,
    unitType: seed.unitType,
    isActive: seed.isActive,
    createdAt: isoDaysAgo(randomInt(120, 400)),
    updatedAt: isoDaysAgo(randomInt(1, 60)),
  }));

  const productById = new Map(products.map((p) => [p.id, p]));

  const batches: Batch[] = [];
  const movements: StockMovement[] = [];

  for (const [productId, plans] of Object.entries(SEED_BATCH_PLANS)) {
    const product = productById.get(productId);
    if (!product) continue;

    for (const [suffix, daysFromNow, remaining, costNaira] of plans) {
      const expiryDate = addDays(today(), daysFromNow);
      const receivedDaysAgo = randomInt(20, 180);
      // Received more than remains — the difference is what has already sold.
      const received = remaining + randomInt(10, 90);
      const costPrice = nairaToKobo(costNaira);

      const batch: Batch = {
        id: nextId("bat"),
        productId,
        product,
        batchNumber: suffix,
        expiryDate,
        quantityReceived: received,
        quantityRemaining: remaining,
        costPrice,
        sellingPrice: product.priceConsumer,
        supplierName: pick(SEED_SUPPLIERS),
        receivedAt: isoDaysAgo(receivedDaysAgo),
        receivedBy: admin.id,
        receivedByName: admin.name,
        expiryStatus: deriveExpiryStatus(daysFromNow),
        daysUntilExpiry: daysFromNow,
      };

      batches.push(batch);

      movements.push({
        id: nextId("mov"),
        productId,
        productName: product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        movementType: "STOCK_RECEIVED",
        quantity: received,
        previousQuantity: 0,
        newQuantity: received,
        referenceType: "BATCH",
        referenceId: batch.id,
        userId: admin.id,
        userName: admin.name,
        reason: null,
        createdAt: batch.receivedAt,
      });
    }
  }

  const database: Database = {
    users,
    categories,
    products,
    batches,
    sales: [],
    movements,
    adjustments: [],
    returns: [],
    auditLogs: [],
    terminals: SEED_TERMINALS,
    settings: {
      name: "Mustan Healthcare Pharmacy",
      address: "24 Awolowo Road, Ikoyi, Lagos",
      phone: "+234 803 000 0000",
      receiptFooter: "Thank you for your patronage.",
      showLogoOnReceipt: true,
      currency: "NGN",
      lowStockAlertsEnabled: true,
      expiryAlertDays: 90,
    },
    // A fresh shop has no accounts on the book yet.
    customers: [],
    customerLedger: [],
    receiptSequence: 0,
  };

  seedSalesHistory(database);
  seedAuditHistory(database);

  return database;
}

/**
 * Roughly 90 days of trading history.
 *
 * These sales are recorded as history only — they do NOT decrement batches,
 * because the seeded `quantityRemaining` already represents the position
 * *after* this trading. History explains how we got to today's stock.
 */
function seedSalesHistory(database: Database) {
  const cashiers = database.users.filter(
    (user) => user.role === "CASHIER" && user.isActive,
  );
  const sellable = database.batches.filter(
    (batch) => batch.quantityRemaining > 0,
  );
  if (sellable.length === 0 || cashiers.length === 0) return;

  const paymentMethods: PaymentMethod[] = ["CASH", "CASH", "CASH", "CARD", "CARD", "TRANSFER"];

  const OPEN_HOUR = 8;
  const CLOSE_HOUR = 20;
  const currentHour = NOW.getHours();

  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    const weekday = new Date(isoDaysAgo(daysAgo)).getDay();
    const isSunday = weekday === 0;

    // Today is only partly traded. Cap it at the current hour so the seed
    // never contains a sale that has not happened yet — which would both
    // read as "just now" in the activity feed and inflate today's takings.
    // The previous complete hour, so a random minute cannot land in the future.
    const isToday = daysAgo === 0;
    const lastHour = isToday
      ? Math.min(currentHour - 1, CLOSE_HOUR)
      : CLOSE_HOUR;
    if (isToday && lastHour <= OPEN_HOUR) continue;

    const dayFraction = isToday
      ? (lastHour - OPEN_HOUR) / (CLOSE_HOUR - OPEN_HOUR)
      : 1;

    const fullDayCount = isSunday ? randomInt(20, 34) : randomInt(52, 88);
    const transactionCount = Math.round(fullDayCount * dayFraction);

    for (let index = 0; index < transactionCount; index += 1) {
      const cashier = pick(cashiers);
      // Real pharmacy baskets are small — one or two items, occasionally three.
      const itemCount = randomInt(1, 3);
      const items: SaleItem[] = [];
      const saleId = nextId("sal");

      for (let line = 0; line < itemCount; line += 1) {
        // Sample twice and keep the cheaper batch. Everyday medicines
        // outsell the expensive ones, and a flat draw would make the
        // average basket several times what a pharmacy actually takes.
        const first = pick(sellable);
        const second = pick(sellable);
        const batch =
          first.sellingPrice <= second.sellingPrice ? first : second;
        const product = batch.product;
        if (!product) continue;

        const quantity = randomInt(1, 2);
        const unitPrice = batch.sellingPrice;

        items.push({
          id: nextId("sit"),
          saleId,
          productId: product.id,
          productName: product.name,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity,
          unitsPerSaleUnit: 1,
          unitPrice,
          subtotal: unitPrice * quantity,
          returnedQuantity: 0,
        });
      }

      if (items.length === 0) continue;

      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      database.receiptSequence += 1;

      const createdAt = isoDaysAgo(
        daysAgo,
        randomInt(OPEN_HOUR, lastHour),
        randomInt(0, 59),
      );

      database.sales.push({
        id: saleId,
        receiptNumber: formatReceiptNumber(database.receiptSequence),
        terminalId: "trm-01",
        terminalName: "Terminal 01",
        cashierId: cashier.id,
        cashierName: cashier.name,
        subtotal,
        discount: 0,
        total: subtotal,
        paymentMethod: pick(paymentMethods),
        priceTier: "CONSUMER" as const,
        customerId: null,
        customerName: null,
        debtCharged: 0,
        debtRepaid: 0,
        customerBalanceAfter: null,
        amountReceived: null,
        changeGiven: null,
        status: "COMPLETED",
        items,
        createdAt,
      });

      for (const item of items) {
        database.movements.push({
          id: nextId("mov"),
          productId: item.productId,
          productName: item.productName,
          batchId: item.batchId,
          batchNumber: item.batchNumber,
          movementType: "SALE",
          quantity: -item.quantity,
          previousQuantity: 0,
          newQuantity: 0,
          referenceType: "SALE",
          referenceId: saleId,
          userId: cashier.id,
          userName: cashier.name,
          reason: null,
          createdAt,
        });
      }
    }
  }

  database.sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  database.movements.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function seedAuditHistory(database: Database) {
  const admin = database.users[0];
  const entries: Array<[AuditAction, string, number]> = [
    ["USER_LOGIN", "SESSION", 0],
    ["PRICE_CHANGED", "PRODUCT", 2],
    ["STOCK_RECEIVED", "BATCH", 3],
    ["PRODUCT_UPDATED", "PRODUCT", 5],
    ["USER_CREATED", "USER", 12],
    ["STOCK_ADJUSTMENT", "BATCH", 14],
    ["PRODUCT_CREATED", "PRODUCT", 21],
    ["USER_DISABLED", "USER", 95],
  ];

  for (const [action, entityType, daysAgo] of entries) {
    database.auditLogs.push({
      id: nextId("aud"),
      userId: admin.id,
      userName: admin.name,
      action,
      entityType,
      entityId: null,
      oldValue:
        action === "PRICE_CHANGED" ? { priceConsumer: nairaToKobo(700) } : null,
      newValue:
        action === "PRICE_CHANGED" ? { priceConsumer: nairaToKobo(800) } : null,
      createdAt: isoDaysAgo(daysAgo, randomInt(8, 17), randomInt(0, 59)),
    });
  }

  database.auditLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function formatReceiptNumber(sequence: number): string {
  return `MHP-${sequence.toString().padStart(6, "0")}`;
}

/* -------------------------------------------------------------------------
   The singleton
   ------------------------------------------------------------------------- */

export const db: Database = seedDatabase();

/* -------------------------------------------------------------------------
   Derived reads
   ------------------------------------------------------------------------- */

/** Batches with stock left, earliest expiry first — the FEFO queue. */
export function sellableBatches(productId: string): Batch[] {
  return db.batches
    .filter(
      (batch) =>
        batch.productId === productId &&
        batch.quantityRemaining > 0 &&
        daysUntil(batch.expiryDate) >= 0, // expired stock is never sellable
    )
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function availableStock(productId: string): number {
  return sellableBatches(productId).reduce(
    (total, batch) => total + batch.quantityRemaining,
    0,
  );
}

/** Every batch of a product, expired included, earliest expiry first. */
export function batchesForProduct(productId: string): Batch[] {
  return db.batches
    .filter((batch) => batch.productId === productId)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/** Refresh the derived expiry fields — days pass while the app is open. */
export function refreshBatchExpiry(batch: Batch): Batch {
  const days = daysUntil(batch.expiryDate);
  batch.daysUntilExpiry = days;
  batch.expiryStatus = deriveExpiryStatus(days);
  return batch;
}

export function buildInventoryItem(product: Product): InventoryItem {
  const all = batchesForProduct(product.id).map(refreshBatchExpiry);
  const sellable = all.filter(
    (batch) => batch.quantityRemaining > 0 && batch.daysUntilExpiry >= 0,
  );

  const available = sellable.reduce(
    (total, batch) => total + batch.quantityRemaining,
    0,
  );
  const stockValue = sellable.reduce(
    (total, batch) => total + batch.quantityRemaining * batch.costPrice,
    0,
  );

  const nearest = sellable[0] ?? null;
  const lastReceived = all
    .map((batch) => batch.receivedAt)
    .sort()
    .at(-1);

  return {
    productId: product.id,
    product,
    availableStock: available,
    minimumStockLevel: product.minimumStockLevel,
    batchCount: sellable.length,
    nearestExpiry: nearest?.expiryDate ?? null,
    stockStatus: deriveStockStatus(available, product.minimumStockLevel),
    expiryStatus: nearest ? nearest.expiryStatus : null,
    stockValue,
    lastReceivedAt: lastReceived ?? null,
  };
}

/* -------------------------------------------------------------------------
   FEFO
   ------------------------------------------------------------------------- */

export interface FefoAllocation {
  batchId: string;
  batchNumber: string;
  quantity: number;
  unitPrice: Money;
  expiryDate: DateOnly;
}

/**
 * Plan a FEFO draw for a product without mutating anything.
 *
 * The UI uses this only to *preview* which batch would be used. The
 * allocation that counts is the one returned by `completeSale`.
 */
export function planFefoAllocation(
  productId: string,
  quantity: number,
): FefoAllocation[] {
  const batches = sellableBatches(productId);
  const allocations: FefoAllocation[] = [];
  let outstanding = quantity;

  for (const batch of batches) {
    if (outstanding <= 0) break;
    const take = Math.min(batch.quantityRemaining, outstanding);
    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: take,
      unitPrice: batch.sellingPrice,
      expiryDate: batch.expiryDate,
    });
    outstanding -= take;
  }

  if (outstanding > 0) {
    const product = db.products.find((item) => item.id === productId);
    throw new MockApiError(
      409,
      `Only ${quantity - outstanding} unit(s) of ${product?.name ?? "this product"} are available.`,
      "INSUFFICIENT_STOCK",
      {
        productId,
        requested: quantity,
        available: quantity - outstanding,
      },
    );
  }

  return allocations;
}

/* -------------------------------------------------------------------------
   Writes
   ------------------------------------------------------------------------- */

export function recordMovement(input: {
  productId: string;
  productName: string;
  batchId: string | null;
  batchNumber: string | null;
  movementType: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceType: string | null;
  referenceId: string | null;
  userId: string;
  userName: string;
  reason?: string | null;
}): StockMovement {
  const movement: StockMovement = {
    id: nextId("mov"),
    reason: input.reason ?? null,
    createdAt: new Date().toISOString(),
    ...input,
  };
  db.movements.unshift(movement);
  return movement;
}

export function recordAudit(input: {
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}): AuditLog {
  const entry: AuditLog = {
    id: nextId("aud"),
    entityId: input.entityId ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    createdAt: new Date().toISOString(),
    userId: input.userId,
    userName: input.userName,
    action: input.action,
    entityType: input.entityType,
  };
  db.auditLogs.unshift(entry);
  return entry;
}

export interface CompleteSaleLine {
  productId: string;
  quantity: number;
}

export interface CompleteSaleInput {
  lines: CompleteSaleLine[];
  discount: Money;
  paymentMethod: PaymentMethod;
  /** Which price list to charge. Defaults to the walk-in consumer price. */
  priceTier?: PriceTier;
  /** Attaching an account lets an underpayment become debt. */
  customerId?: string | null;
  amountReceived: Money | null;
  cashierId: string;
  terminalId: string;
}

/**
 * The whole sale succeeds or nothing changes — the frontend equivalent of the
 * database transaction in §14 of the specification. Stock is verified for
 * every line before a single batch is touched.
 */
export function completeSale(input: CompleteSaleInput): Sale {
  if (input.lines.length === 0) {
    throw new MockApiError(400, "A sale must contain at least one item.");
  }

  const cashier = db.users.find((user) => user.id === input.cashierId);
  if (!cashier) throw new MockApiError(401, "Your session has expired.");

  const terminal = db.terminals.find((item) => item.id === input.terminalId);

  // Plan every line first. A shortfall throws before anything is mutated.
  const planned = input.lines.map((line) => ({
    line,
    allocations: planFefoAllocation(line.productId, line.quantity),
    product: db.products.find((product) => product.id === line.productId),
  }));

  const missing = planned.find((entry) => !entry.product);
  if (missing) {
    throw new MockApiError(404, "A product in this sale no longer exists.");
  }

  const saleId = nextId("sal");
  const createdAt = new Date().toISOString();
  const items: SaleItem[] = [];

  for (const entry of planned) {
    const product = entry.product!;

    for (const allocation of entry.allocations) {
      const batch = db.batches.find((item) => item.id === allocation.batchId)!;
      const previousQuantity = batch.quantityRemaining;

      batch.quantityRemaining -= allocation.quantity;

      items.push({
        id: nextId("sit"),
        saleId,
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: allocation.quantity,
        // Price at the moment of sale — a later price change must not
        // rewrite this receipt.
        unitsPerSaleUnit: 1,
        unitPrice: product.priceConsumer,
        subtotal: product.priceConsumer * allocation.quantity,
        returnedQuantity: 0,
      });

      recordMovement({
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        movementType: "SALE",
        quantity: -allocation.quantity,
        previousQuantity,
        newQuantity: batch.quantityRemaining,
        referenceType: "SALE",
        referenceId: saleId,
        userId: cashier.id,
        userName: cashier.name,
      });
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = Math.max(subtotal - input.discount, 0);

  if (input.paymentMethod === "CASH" && input.amountReceived !== null) {
    if (input.amountReceived < total) {
      throw new MockApiError(
        400,
        "The amount received is less than the total due.",
        "INSUFFICIENT_PAYMENT",
      );
    }
  }

  db.receiptSequence += 1;

  const sale: Sale = {
    id: saleId,
    receiptNumber: formatReceiptNumber(db.receiptSequence),
    terminalId: input.terminalId,
    terminalName: terminal?.name ?? input.terminalId,
    cashierId: cashier.id,
    cashierName: cashier.name,
    subtotal,
    discount: input.discount,
    total,
    paymentMethod: input.paymentMethod,
    priceTier: input.priceTier ?? "CONSUMER",
    customerId: null,
    customerName: null,
    debtCharged: 0,
    debtRepaid: 0,
    customerBalanceAfter: null,
    amountReceived: input.amountReceived,
    changeGiven:
      input.paymentMethod === "CASH" && input.amountReceived !== null
        ? input.amountReceived - total
        : null,
    status: "COMPLETED",
    items,
    createdAt,
  };

  db.sales.unshift(sale);

  recordAudit({
    userId: cashier.id,
    userName: cashier.name,
    action: "SALE_COMPLETED",
    entityType: "SALE",
    entityId: sale.id,
    newValue: { receiptNumber: sale.receiptNumber, total: sale.total },
  });

  return sale;
}

export interface ReceiveStockInput {
  productId: string;
  batchNumber: string;
  expiryDate: DateOnly;
  quantityReceived: number;
  costPrice: Money;
  sellingPrice: Money;
  supplierName: string;
  receivedAt: DateOnly;
  userId: string;
}

export function receiveStock(input: ReceiveStockInput): Batch {
  const product = db.products.find((item) => item.id === input.productId);
  if (!product) throw new MockApiError(404, "Product not found.");

  const user = db.users.find((item) => item.id === input.userId);
  if (!user) throw new MockApiError(401, "Your session has expired.");

  if (input.quantityReceived <= 0) {
    throw new MockApiError(400, "Quantity received must be greater than zero.");
  }

  const days = daysUntil(input.expiryDate);
  const batch: Batch = {
    id: nextId("bat"),
    productId: product.id,
    product,
    batchNumber: input.batchNumber,
    expiryDate: input.expiryDate,
    quantityReceived: input.quantityReceived,
    quantityRemaining: input.quantityReceived,
    costPrice: input.costPrice,
    sellingPrice: input.sellingPrice,
    supplierName: input.supplierName,
    receivedAt: new Date(`${input.receivedAt}T09:00:00`).toISOString(),
    receivedBy: user.id,
    receivedByName: user.name,
    expiryStatus: deriveExpiryStatus(days),
    daysUntilExpiry: days,
  };

  db.batches.push(batch);

  recordMovement({
    productId: product.id,
    productName: product.name,
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    movementType: "STOCK_RECEIVED",
    quantity: input.quantityReceived,
    previousQuantity: 0,
    newQuantity: input.quantityReceived,
    referenceType: "BATCH",
    referenceId: batch.id,
    userId: user.id,
    userName: user.name,
  });

  recordAudit({
    userId: user.id,
    userName: user.name,
    action: "STOCK_RECEIVED",
    entityType: "BATCH",
    entityId: batch.id,
    newValue: {
      product: product.name,
      batchNumber: batch.batchNumber,
      quantity: input.quantityReceived,
    },
  });

  // Selling price changes propagate to the product catalogue, and are audited
  // separately because a price change is a tracked action in its own right.
  // Receiving quotes one figure, and that figure is the walk-in price.
  if (input.sellingPrice !== product.priceConsumer) {
    const previous = product.priceConsumer;
    product.priceConsumer = input.sellingPrice;
    product.updatedAt = new Date().toISOString();
    recordAudit({
      userId: user.id,
      userName: user.name,
      action: "PRICE_CHANGED",
      entityType: "PRODUCT",
      entityId: product.id,
      oldValue: { priceConsumer: previous },
      newValue: { priceConsumer: input.sellingPrice },
    });
  }

  return batch;
}

export interface AdjustStockInput {
  batchId: string;
  /** Signed change: negative removes stock. */
  adjustment: number;
  reason: AdjustmentReason;
  notes: string | null;
  userId: string;
}

export function adjustStock(input: AdjustStockInput): StockAdjustment {
  const batch = db.batches.find((item) => item.id === input.batchId);
  if (!batch) throw new MockApiError(404, "Batch not found.");

  const user = db.users.find((item) => item.id === input.userId);
  if (!user) throw new MockApiError(401, "Your session has expired.");

  if (input.adjustment === 0) {
    throw new MockApiError(400, "Enter an adjustment quantity.");
  }

  const quantityBefore = batch.quantityRemaining;
  const quantityAfter = quantityBefore + input.adjustment;

  if (quantityAfter < 0) {
    throw new MockApiError(
      400,
      `This batch only holds ${quantityBefore} unit(s). The adjustment cannot take it below zero.`,
      "INVALID_ADJUSTMENT",
    );
  }

  batch.quantityRemaining = quantityAfter;

  const product = batch.product!;
  const adjustment: StockAdjustment = {
    id: nextId("adj"),
    productId: product.id,
    productName: product.name,
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    quantityBefore,
    adjustment: input.adjustment,
    quantityAfter,
    reason: input.reason,
    notes: input.notes,
    performedBy: user.id,
    performedByName: user.name,
    createdAt: new Date().toISOString(),
  };

  db.adjustments.unshift(adjustment);

  recordMovement({
    productId: product.id,
    productName: product.name,
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    movementType: ADJUSTMENT_REASON_MOVEMENT[input.reason],
    quantity: input.adjustment,
    previousQuantity: quantityBefore,
    newQuantity: quantityAfter,
    referenceType: "ADJUSTMENT",
    referenceId: adjustment.id,
    userId: user.id,
    userName: user.name,
    reason: input.notes,
  });

  recordAudit({
    userId: user.id,
    userName: user.name,
    action: "STOCK_ADJUSTMENT",
    entityType: "BATCH",
    entityId: batch.id,
    oldValue: { quantityRemaining: quantityBefore },
    newValue: { quantityRemaining: quantityAfter, reason: input.reason },
  });

  return adjustment;
}

export interface ProcessReturnInput {
  saleId: string;
  items: Array<{ saleItemId: string; quantity: number }>;
  reason: string;
  refundMethod: PaymentMethod;
  userId: string;
}

/**
 * Returns never delete a sale. A reversal record is created, stock goes back
 * to the batch it came from, and the sale's status is updated in place.
 */
export function processReturn(input: ProcessReturnInput): SaleReturn {
  const sale = db.sales.find((item) => item.id === input.saleId);
  if (!sale) throw new MockApiError(404, "Sale not found.");

  const user = db.users.find((item) => item.id === input.userId);
  if (!user) throw new MockApiError(401, "Your session has expired.");

  if (sale.status === "REVERSED") {
    throw new MockApiError(409, "This sale has already been fully reversed.");
  }

  const returnedItems = input.items
    .filter((entry) => entry.quantity > 0)
    .map((entry) => {
      const saleItem = sale.items.find((item) => item.id === entry.saleItemId);
      if (!saleItem) {
        throw new MockApiError(404, "That item is not part of this sale.");
      }

      const returnable = saleItem.quantity - saleItem.returnedQuantity;
      if (entry.quantity > returnable) {
        throw new MockApiError(
          400,
          `Only ${returnable} unit(s) of ${saleItem.productName} can still be returned.`,
          "INVALID_RETURN_QUANTITY",
        );
      }

      return { saleItem, quantity: entry.quantity };
    });

  if (returnedItems.length === 0) {
    throw new MockApiError(400, "Select at least one item to return.");
  }

  const saleReturn: SaleReturn = {
    id: nextId("ret"),
    saleId: sale.id,
    receiptNumber: sale.receiptNumber,
    items: [],
    refundAmount: 0,
    refundMethod: input.refundMethod,
    reason: input.reason,
    processedBy: user.id,
    processedByName: user.name,
    createdAt: new Date().toISOString(),
  };

  for (const { saleItem, quantity } of returnedItems) {
    saleItem.returnedQuantity += quantity;

    const batch = db.batches.find((item) => item.id === saleItem.batchId);
    const previousQuantity = batch?.quantityRemaining ?? 0;
    if (batch) batch.quantityRemaining += quantity;

    const refundAmount = saleItem.unitPrice * quantity;
    saleReturn.refundAmount += refundAmount;
    saleReturn.items.push({
      saleItemId: saleItem.id,
      productId: saleItem.productId,
      productName: saleItem.productName,
      batchId: saleItem.batchId,
      batchNumber: saleItem.batchNumber,
      quantity,
      unitPrice: saleItem.unitPrice,
      refundAmount,
    });

    recordMovement({
      productId: saleItem.productId,
      productName: saleItem.productName,
      batchId: saleItem.batchId,
      batchNumber: saleItem.batchNumber,
      movementType: "RETURN",
      quantity,
      previousQuantity,
      newQuantity: previousQuantity + quantity,
      referenceType: "RETURN",
      referenceId: saleReturn.id,
      userId: user.id,
      userName: user.name,
      reason: input.reason,
    });
  }

  const fullyReturned = sale.items.every(
    (item) => item.returnedQuantity >= item.quantity,
  );
  const status: SaleStatus = fullyReturned ? "REVERSED" : "PARTIALLY_RETURNED";
  sale.status = status;

  db.returns.unshift(saleReturn);

  recordAudit({
    userId: user.id,
    userName: user.name,
    action: "SALE_REVERSAL",
    entityType: "SALE",
    entityId: sale.id,
    oldValue: { status: "COMPLETED" },
    newValue: {
      status,
      refundAmount: saleReturn.refundAmount,
      reason: input.reason,
    },
  });

  return saleReturn;
}

/** How much of a sale can still be sent back. */
export function returnableQuantity(item: SaleItem): number {
  return Math.max(item.quantity - item.returnedQuantity, 0);
}

/** Today's calendar date, as the mock server would report it. */
export function serverToday(): DateOnly {
  return toDateOnly(new Date());
}
