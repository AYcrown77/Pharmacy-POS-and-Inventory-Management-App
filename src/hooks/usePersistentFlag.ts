"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A boolean preference kept in `localStorage` (sidebar collapsed, table
 * density, and similar per-machine choices).
 *
 * Uses an external store rather than reading storage inside an effect: it
 * gives a defined server snapshot, so there is no hydration mismatch and no
 * cascading render on mount.
 */

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

function read(key: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : raw === "true";
  } catch {
    return null;
  }
}

export function usePersistentFlag(
  key: string,
  defaultValue = false,
): [boolean, (value: boolean) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      const existing = listeners.get(key) ?? new Set();
      existing.add(listener);
      listeners.set(key, existing);

      // Keep terminals in step when the same preference changes in another tab.
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);

      return () => {
        existing.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(
    () => read(key) ?? defaultValue,
    [key, defaultValue],
  );

  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setValue = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Storage unavailable; the preference lasts for this page view only.
      }
      notify(key);
    },
    [key],
  );

  return [value, setValue];
}
