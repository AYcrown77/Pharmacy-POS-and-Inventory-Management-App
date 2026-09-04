/**
 * Audit trail.
 *
 * Read-only by design. Entries are written as a side effect of the actions
 * they record, and there is no endpoint to edit or delete one — an audit log
 * that can be rewritten is not an audit log.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { http } from "@/lib/api/http";
import { timestampToDateOnly } from "@/lib/date";
import { db } from "@/mocks/db";
import { matchesSearch, mockRequest, paginate, sortBy } from "@/mocks/latency";
import type { DateOnly, ListParams, Paginated } from "@/types/common";
import type { AuditAction, AuditLog } from "@/types/domain";

export interface AuditFilters extends ListParams {
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  from?: DateOnly;
  to?: DateOnly;
}

export interface AuditService {
  list(filters?: AuditFilters): Promise<Paginated<AuditLog>>;
  /** Distinct entity types present, for the filter dropdown. */
  listEntityTypes(): Promise<string[]>;
}

const mockAuditService: AuditService = {
  list: (filters = {}) =>
    mockRequest(() => {
      const entries = db.auditLogs.filter((entry) => {
        const day = timestampToDateOnly(entry.createdAt);
        return (
          (!filters.userId || entry.userId === filters.userId) &&
          (!filters.action || entry.action === filters.action) &&
          (!filters.entityType || entry.entityType === filters.entityType) &&
          (!filters.from || day >= filters.from) &&
          (!filters.to || day <= filters.to) &&
          matchesSearch(
            filters.search,
            entry.userName,
            entry.entityType,
            entry.entityId,
          )
        );
      });

      return paginate(
        sortBy(entries, (entry) => entry.createdAt, "desc"),
        filters,
      );
    }),

  listEntityTypes: () =>
    mockRequest(() => {
      const types = new Set(db.auditLogs.map((entry) => entry.entityType));
      return [...types].sort((a, b) => a.localeCompare(b));
    }),
};

const httpAuditService: AuditService = {
  list: (filters) =>
    http.get<Paginated<AuditLog>>("/audit", { params: filters }),
  listEntityTypes: () => http.get<string[]>("/audit/entity-types"),
};

export const auditService: AuditService = USE_MOCKS
  ? mockAuditService
  : httpAuditService;
