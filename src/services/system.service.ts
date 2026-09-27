/**
 * System: server health, terminals and pharmacy settings.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { http } from "@/lib/api/http";
import { db, recordAudit } from "@/mocks/db";
import { mockRequest } from "@/mocks/latency";
import type { BackupStatus } from "@/types/backup";
import type { PharmacySettings, Terminal } from "@/types/domain";

export interface ServerHealth {
  status: "ok";
  /** Server time, so terminals can flag a clock drift against the till. */
  serverTime: string;
}

export interface SystemService {
  health(): Promise<ServerHealth>;
  /** Administrator only: how the shop's backups are doing. */
  getBackupStatus(): Promise<BackupStatus>;
  /**
   * Administrator only. Asks the server to take a backup now; it answers as
   * soon as the job has started, not when it has finished, so the caller polls
   * the status until `running` goes false.
   */
  runBackup(): Promise<BackupStatus>;
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

  // Nothing is really backed up in mock mode, but the card has to render
  // something truthful: a shop where everything is in order.
  getBackupStatus: () =>
    mockRequest(() => ({
      health: "OK" as const,
      problems: [],
      lastBackupAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      lastBackupSize: 2_100_000,
      lastError: null,
      backupCount: 48,
      oldestBackupAt: new Date(Date.now() - 320 * 24 * 60 * 60 * 1000).toISOString(),
      copies: [
        {
          kind: "MIRROR" as const,
          target: "E:\\MustanBackups",
          lastCopiedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          working: true,
          detail: null,
        },
      ],
      lastRestoreTestAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      restoreTestPassed: true,
      restoreTestDetail: "products=412, sales=6804",
      running: false,
      scheduled: true,
      location: "deploy\\backups",
    })),

  runBackup: () => mockSystemService.getBackupStatus(),

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
  getBackupStatus: () => http.get<BackupStatus>("/backups"),
  runBackup: () => http.post<BackupStatus>("/backups/run", {}),
  getSettings: () => http.get<PharmacySettings>("/settings"),
  updateSettings: (input) => http.put<PharmacySettings>("/settings", input),
};

export const systemService: SystemService = USE_MOCKS
  ? mockSystemService
  : httpSystemService;
