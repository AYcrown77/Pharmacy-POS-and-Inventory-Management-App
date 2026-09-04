"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, ticking once a minute.
 *
 * Implemented as an external store rather than `useState` + `useEffect` for
 * two reasons: the server has no idea what time it is on the till (so it must
 * render nothing and let the client fill it in), and a single shared interval
 * serves every clock in the application instead of one timer per component.
 */

const TICK_MS = 30_000;

let currentTime = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (!timer) {
    timer = setInterval(() => {
      currentTime = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return currentTime;
}

/** No clock on the server — the component renders a placeholder instead. */
function getServerSnapshot(): null {
  return null;
}

export function useNow(): Date | null {
  const timestamp = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return timestamp === null ? null : new Date(timestamp);
}
