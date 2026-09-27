/**
 * The shop's backups, as the Settings screen shows them.
 *
 * Windows takes the backups on a schedule; the server only reports what
 * happened and can ask for one now. Mirrors `types/system/backup.ts` in the
 * API.
 */

import type { Timestamp } from "./common";

/** Worst thing currently true of the backups. */
export type BackupHealth = "OK" | "ATTENTION" | "CRITICAL" | "UNKNOWN";

/** One place the backups are copied to: a USB stick, a folder that syncs. */
export interface BackupCopy {
  kind: "MIRROR" | "OFFSITE";
  target: string;
  lastCopiedAt: Timestamp | null;
  working: boolean;
  detail: string | null;
}

export interface BackupStatus {
  health: BackupHealth;
  /** Plain sentences, worst first. Empty when everything is in order. */
  problems: string[];
  lastBackupAt: Timestamp | null;
  /** Bytes. */
  lastBackupSize: number;
  lastError: string | null;
  backupCount: number;
  oldestBackupAt: Timestamp | null;
  copies: BackupCopy[];
  lastRestoreTestAt: Timestamp | null;
  restoreTestPassed: boolean | null;
  restoreTestDetail: string | null;
  /** A backup started from this screen has not finished yet. */
  running: boolean;
  /** False when nothing on this PC is scheduled to back up by itself. */
  scheduled: boolean;
  location: string | null;
}
