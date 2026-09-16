/**
 * Expenses — money paid out of the business: generator fuel, a delivery,
 * repairs.
 *
 * Append-only, like sales. An expense recorded in error is voided with a
 * reason rather than deleted, so there is no delete method here.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { ApiError, http } from "@/lib/api/http";
import { today } from "@/lib/date";
import { mockRequest, paginate } from "@/mocks/latency";
import type { DateOnly, DateRange, ListParams, Money, Paginated } from "@/types/common";
import type { ExpenseSummary } from "@/types/analytics";
import type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  PaymentMethod,
} from "@/types/domain";

export interface ExpenseFilters extends ListParams {
  from?: DateOnly;
  to?: DateOnly;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  recordedById?: string;
}

export interface ExpenseInput {
  expenseDate: DateOnly;
  category: ExpenseCategory;
  amount: Money;
  paymentMethod: PaymentMethod;
  reason: string;
}

export interface ExpensesService {
  list(filters?: ExpenseFilters): Promise<Paginated<Expense>>;
  /** Recorded (not voided) expenses in a period. */
  summary(range: DateRange): Promise<ExpenseSummary>;
  record(input: ExpenseInput): Promise<Expense>;
  voidExpense(id: string, reason: string): Promise<Expense>;
}

/* -------------------------------------------------------------------------
   Mock adapter
   ------------------------------------------------------------------------- */

const mockExpenses: Expense[] = [];

function inRange(expense: Expense, from?: DateOnly, to?: DateOnly) {
  return (!from || expense.expenseDate >= from) && (!to || expense.expenseDate <= to);
}

const mockExpensesService: ExpensesService = {
  list: (filters = {}) =>
    mockRequest(() =>
      paginate(
        mockExpenses.filter(
          (expense) =>
            inRange(expense, filters.from, filters.to) &&
            (!filters.category || expense.category === filters.category) &&
            (!filters.status || expense.status === filters.status),
        ),
        filters,
      ),
    ),

  summary: (range) =>
    mockRequest(() => {
      const recorded = mockExpenses.filter(
        (expense) =>
          expense.status === "RECORDED" && inRange(expense, range.from, range.to),
      );
      const byCategory = new Map<ExpenseCategory, { total: Money; count: number }>();
      for (const expense of recorded) {
        const entry = byCategory.get(expense.category) ?? { total: 0, count: 0 };
        entry.total += expense.amount;
        entry.count += 1;
        byCategory.set(expense.category, entry);
      }
      return {
        total: recorded.reduce((total, expense) => total + expense.amount, 0),
        count: recorded.length,
        byCategory: [...byCategory.entries()]
          .map(([category, entry]) => ({ category, ...entry }))
          .sort((a, b) => b.total - a.total),
      };
    }),

  record: (input) =>
    mockRequest(() => {
      if (input.expenseDate > today()) {
        throw new ApiError(400, "An expense cannot be dated in the future.");
      }
      const expense: Expense = {
        id: `exp-${Date.now().toString(36)}`,
        ...input,
        recordedById: "",
        recordedByName: "You",
        status: "RECORDED",
        voidReason: null,
        voidedById: null,
        voidedByName: null,
        voidedAt: null,
        createdAt: new Date().toISOString(),
      };
      mockExpenses.unshift(expense);
      return expense;
    }),

  voidExpense: (id, reason) =>
    mockRequest(() => {
      const expense = mockExpenses.find((item) => item.id === id);
      if (!expense) throw new ApiError(404, "Expense not found.");
      if (expense.status === "VOIDED") {
        throw new ApiError(409, "This expense has already been voided.");
      }
      Object.assign(expense, {
        status: "VOIDED",
        voidReason: reason,
        voidedByName: "You",
        voidedAt: new Date().toISOString(),
      });
      return expense;
    }),
};

/* -------------------------------------------------------------------------
   HTTP adapter
   ------------------------------------------------------------------------- */

const httpExpensesService: ExpensesService = {
  list: (filters) => http.get<Paginated<Expense>>("/expenses", { params: filters }),
  summary: (range) => http.get<ExpenseSummary>("/expenses/summary", { params: range }),
  record: (input) => http.post<Expense>("/expenses", input),
  voidExpense: (id, reason) => http.post<Expense>(`/expenses/${id}/void`, { reason }),
};

export const expensesService: ExpensesService = USE_MOCKS
  ? mockExpensesService
  : httpExpensesService;
