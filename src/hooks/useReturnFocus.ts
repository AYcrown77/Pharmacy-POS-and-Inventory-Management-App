"use client";

import { useEffect, useRef } from "react";

/**
 * Returns focus to whatever opened an overlay once it closes.
 *
 * Radix restores focus itself, but only reliably when the overlay is opened
 * through its own `Trigger`. Every dialog here is opened programmatically —
 * from a row action, or a controlled `open` prop — and measurement showed
 * focus landing on `<body>` after close, which drops a keyboard user at the
 * top of the page with no idea where they were.
 *
 * Two things were learned building this, and both shape the implementation:
 *
 *  1. Reading `document.activeElement` when the dialog opens is too late. A
 *     field with `autoFocus` is focused by React during commit, before any
 *     Radix callback runs, so the trigger is already gone. The last focus
 *     *outside* any dialog is therefore tracked continuously instead.
 *
 *  2. Radix's `onCloseAutoFocus` did not fire for every dialog here, so the
 *     restore is driven off the `open` prop changing rather than off that
 *     callback — which is under this component's control either way.
 */

let lastExternalFocus: HTMLElement | null = null;
let listening = false;

function trackFocus(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  // Focus moving inside an overlay must not overwrite the trigger.
  if (target.closest('[role="dialog"]')) return;
  lastExternalFocus = target;
}

function startTracking() {
  if (listening || typeof document === "undefined") return;
  document.addEventListener("focusin", trackFocus, true);
  listening = true;
}

// Starts when this module is first imported, well before any dialog opens.
startTracking();

export function useReturnFocus(open: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      // Opening: remember where the user was.
      triggerRef.current = lastExternalFocus;
    } else if (!open && wasOpen.current) {
      // Closing: put them back.
      const trigger = triggerRef.current;
      if (trigger && document.body.contains(trigger)) {
        const focusTrigger = () => trigger.focus({ preventScroll: false });

        // While an overlay is open Radix marks the rest of the page inert and
        // clears that asynchronously, so an early focus call is swallowed.
        // Retry once on the next task if the first attempt did not take.
        requestAnimationFrame(() => {
          focusTrigger();
          if (document.activeElement !== trigger) {
            setTimeout(focusTrigger, 0);
          }
        });
      }
    }

    wasOpen.current = open;
  }, [open]);
}
