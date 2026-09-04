"use client";

import { useEffect, useState } from "react";

/**
 * Delays a value so a search box does not fire a request per keystroke.
 *
 * 250ms is comfortably below the point a typist notices a lag, and above the
 * gap between keystrokes for anyone typing at speed.
 */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
