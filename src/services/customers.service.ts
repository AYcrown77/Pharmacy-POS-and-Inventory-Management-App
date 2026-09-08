/**
 * Customer accounts and their debt.
 *
 * A balance never moves from here directly — it moves as a consequence of a
 * sale or a repayment, each of which writes a ledger entry on the server. So
 * there is deliberately no `setBalance`: a figure that could be typed over
 * would be a figure nobody could explain.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { ApiError, http } from "@/lib/api/http";
import { mockRequest, matchesSearch, paginate } from "@/mocks/latency";
import { db } from "@/mocks/db";
import type { ListParams, Money, Paginated } from "@/types/common";
import type { Customer, CustomerLedgerEntry } from "@/types/domain";

export interface CustomerFilters extends ListParams {
  isActive?: boolean;
  /** Narrows to accounts currently in debt — the usual question. */
  owing?: boolean;
}

export interface CustomerInput {
  name: string;
  phone: string | null;
  note: string | null;
}

export interface CustomerLedger {
  customer: Customer;
  entries: Paginated<CustomerLedgerEntry>;
}

export interface RepaymentInput {
  amount: Money;
  reason: string | null;
  /** Confirms a payment larger than the balance, leaving them in credit. */
  allowOverpayment?: boolean;
}

export interface CustomersService {
  list(filters?: CustomerFilters): Promise<Paginated<Customer>>;
  getById(id: string): Promise<Customer>;
  getLedger(id: string, params?: ListParams): Promise<CustomerLedger>;
  create(input: CustomerInput): Promise<Customer>;
  update(id: string, input: CustomerInput): Promise<Customer>;
  recordRepayment(
    id: string,
    input: RepaymentInput,
  ): Promise<{ customer: Customer; entry: CustomerLedgerEntry }>;
}

/* -------------------------------------------------------------------------
   Mock adapter
   ------------------------------------------------------------------------- */

const mockCustomersService: CustomersService = {
  list: (filters = {}) =>
    mockRequest(() => {
      const customers = db.customers.filter(
        (customer) =>
          (filters.isActive === undefined ||
            customer.isActive === filters.isActive) &&
          (!filters.owing || customer.balance > 0) &&
          matchesSearch(filters.search, customer.name, customer.phone),
      );
      return paginate(customers, filters);
    }),

  getById: (id) =>
    mockRequest(() => {
      const customer = db.customers.find((item) => item.id === id);
      if (!customer) throw new ApiError(404, "Customer not found.");
      return customer;
    }),

  getLedger: (id, params = {}) =>
    mockRequest(() => {
      const customer = db.customers.find((item) => item.id === id);
      if (!customer) throw new ApiError(404, "Customer not found.");
      const entries = db.customerLedger.filter(
        (entry) => entry.customerId === id,
      );
      return { customer, entries: paginate(entries, params) };
    }),

  create: (input) =>
    mockRequest(() => {
      const customer: Customer = {
        id: `cus-${Date.now().toString(36)}`,
        name: input.name.trim(),
        phone: input.phone,
        note: input.note,
        balance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.customers.push(customer);
      return customer;
    }),

  update: (id, input) =>
    mockRequest(() => {
      const customer = db.customers.find((item) => item.id === id);
      if (!customer) throw new ApiError(404, "Customer not found.");
      Object.assign(customer, input, { updatedAt: new Date().toISOString() });
      return customer;
    }),

  recordRepayment: (id, input) =>
    mockRequest(() => {
      const customer = db.customers.find((item) => item.id === id);
      if (!customer) throw new ApiError(404, "Customer not found.");

      if (input.amount > customer.balance && !input.allowOverpayment) {
        throw new ApiError(
          400,
          `That is more than ${customer.name} owes.`,
          "OVERPAYMENT",
        );
      }

      const balanceBefore = customer.balance;
      customer.balance -= input.amount;

      const entry: CustomerLedgerEntry = {
        id: `led-${Date.now().toString(36)}`,
        customerId: id,
        entryType: "REPAYMENT",
        amount: -input.amount,
        balanceBefore,
        balanceAfter: customer.balance,
        saleId: null,
        receiptNumber: null,
        reason: input.reason,
        userId: "",
        userName: "",
        createdAt: new Date().toISOString(),
      };
      db.customerLedger.unshift(entry);

      return { customer, entry };
    }),
};

/* -------------------------------------------------------------------------
   HTTP adapter
   ------------------------------------------------------------------------- */

const httpCustomersService: CustomersService = {
  list: (filters) =>
    http.get<Paginated<Customer>>("/customers", { params: filters }),
  getById: (id) => http.get<Customer>(`/customers/${id}`),
  getLedger: (id, params) =>
    http.get<CustomerLedger>(`/customers/${id}/ledger`, { params }),
  create: (input) => http.post<Customer>("/customers", input),
  update: (id, input) => http.patch<Customer>(`/customers/${id}`, input),
  recordRepayment: (id, input) =>
    http.post<{ customer: Customer; entry: CustomerLedgerEntry }>(
      `/customers/${id}/repayment`,
      input,
    ),
};

export const customersService: CustomersService = USE_MOCKS
  ? mockCustomersService
  : httpCustomersService;
