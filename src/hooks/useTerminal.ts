"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { TerminalType } from "@/types/domain";

/**
 * Terminal identity.
 *
 * Which physical till this browser is stands as a property of the machine,
 * not the user — it is chosen once at setup and persists across sign-ins.
 * Later this can come from server configuration keyed by IP; the shape of
 * what the app consumes will not change.
 */

const STORAGE_KEY = "mhp.terminal";
const DEFAULT_TERMINAL_ID = "trm-01";

export interface TerminalOption {
  id: string;
  name: string;
  shortName: string;
  location: string;
  type: TerminalType;
}

export const TERMINAL_OPTIONS: TerminalOption[] = [
  {
    id: "trm-01",
    name: "Checkout Terminal",
    shortName: "T01",
    location: "Front counter",
    type: "CHECKOUT",
  },
  {
    id: "trm-03",
    name: "Admin Terminal",
    shortName: "T03",
    location: "Back office",
    type: "ADMIN",
  },
];

export function findTerminal(id: string): TerminalOption {
  return (
    TERMINAL_OPTIONS.find((terminal) => terminal.id === id) ??
    TERMINAL_OPTIONS[0]
  );
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TERMINAL_ID;
  } catch {
    return DEFAULT_TERMINAL_ID;
  }
}

/** The server render has no browser storage; assume the checkout till. */
function getServerSnapshot(): string {
  return DEFAULT_TERMINAL_ID;
}

export function useTerminal() {
  const storedId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // A machine that was set up as a terminal since retired still has that id in
  // its browser storage. Resolving through `findTerminal` first means the id
  // sent with a sale is always one that still exists, rather than the stale
  // value while the badge shows the fallback.
  const terminal = findTerminal(storedId);

  const setTerminalId = useCallback((id: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage unavailable — the choice lasts for this page view only.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return {
    terminalId: terminal.id,
    terminal,
    setTerminalId,
  };
}
