/**
 * System: server health, terminals and pharmacy settings.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { http } from "@/lib/api/http";
import { db, recordAudit } from "@/mocks/db";
import { mockRequest } from "@/mocks/latency";
import type { PharmacySettings, Terminal } from "@/types/domain";

export interface ServerHealth {
  status: "ok";
  /** Server time, so terminals can flag a clock drift against the till. */
  serverTime: string;
}

export interface SystemService {
  health(): Promise<ServerHealth>;
  listTerminals(): Promise<Terminal[]>;
  getSettings(): Promise<PharmacySettings>;
  updateSettings(
    input: PharmacySettings,
    userId: string,
  ): Promise<PharmacySettings>;
}

const mockSystemService: SystemService = {
  // Deliberately fast: the connection indicator should not lag behind reality.
  health: async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
    return { status: "ok", serverTime: new Date().toISOString() };
  },

  listTerminals: () => mockRequest(() => [...db.terminals]),

  getSettings: () => mockRequest(() => ({ ...db.settings })),

  updateSettings: (input, userId) =>
    mockRequest(() => {
      const user = db.users.find((item) => item.id === userId);
      const previous = { ...db.settings };
      Object.assign(db.settings, input);

      if (user) {
        recordAudit({
          userId: user.id,
          userName: user.name,
          action: "SETTINGS_UPDATED",
          entityType: "SETTINGS",
          oldValue: { name: previous.name, phone: previous.phone },
          newValue: { name: input.name, phone: input.phone },
        });
      }

      return { ...db.settings };
    }),
};

const httpSystemService: SystemService = {
  health: () => http.get<ServerHealth>("/health"),
  listTerminals: () => http.get<Terminal[]>("/terminals"),
  getSettings: () => http.get<PharmacySettings>("/settings"),
  updateSettings: (input) => http.put<PharmacySettings>("/settings", input),
};

export const systemService: SystemService = USE_MOCKS
  ? mockSystemService
  : httpSystemService;
