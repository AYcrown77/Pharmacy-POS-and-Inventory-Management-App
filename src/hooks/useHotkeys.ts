"use client";

import { useEffect, useRef } from "react";

/**
 * Global keyboard shortcuts.
 *
 * Function keys are handled wherever focus happens to be — the whole point of
 * F9 is that a cashier can press it without first clicking anything. Printable
 * keys are ignored while a field has focus, so typing into the scan box never
 * triggers a shortcut.
 */

type Handler = (event: KeyboardEvent) => void;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useHotkeys(
  bindings: Record<string, Handler>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  // Kept in a ref so the listener is attached once and never sees a stale
  // closure over cart state. Written in an effect, not during render — a ref
  // mutation during render is not safe under concurrent rendering.
  const bindingsRef = useRef(bindings);
  useEffect(() => {
    bindingsRef.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const handler = bindingsRef.current[event.key];
      if (!handler) return;

      const isFunctionKey = /^F\d{1,2}$/.test(event.key);
      if (!isFunctionKey && event.key !== "Escape" && isEditable(event.target)) {
        return;
      }

      // The browser's own F-key behaviour would otherwise win.
      event.preventDefault();
      handler(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
