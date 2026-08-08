"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Detects the user coming back from the processor.
 *
 * Why this exists: WinRed and ActBlue both forbid framing
 * (`frame-ancestors 'none'`, `X-Frame-Options`), and the same-origin policy
 * makes it impossible for us to read or screenshot a page we don't own. So we
 * cannot observe the contribution itself. What we can observe, reliably, is
 * the user's attention returning to our tab.
 *
 * Three independent signals, because no single one covers every browser:
 *
 *   1. `visibilitychange` — the main path. Fires on desktop tab switching and
 *      on mobile when the user swipes back to our tab.
 *   2. polling `popup.closed` — covers the user closing the processor tab
 *      outright, which fires no event in our document.
 *   3. `pageshow` with `persisted` — iOS Safari restores our page from the
 *      back-forward cache without firing visibilitychange.
 *
 * The `minAwayMs` gate is what keeps this from being annoying: an accidental
 * alt-tab shouldn't trigger "did you contribute?". Nobody completes a donation
 * form in under three seconds.
 */

export type ReturnDetectionState = "idle" | "waiting" | "returned";

interface Options {
  /** Ignore returns faster than this; the user can't have finished. */
  minAwayMs?: number;
  onReturn?: () => void;
}

export function useReturnDetection({ minAwayMs = 3000, onReturn }: Options = {}) {
  const [state, setState] = useState<ReturnDetectionState>("idle");

  const popupRef = useRef<Window | null>(null);
  const leftAtRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const onReturnRef = useRef(onReturn);

  // Keep the callback fresh without re-subscribing listeners on every render.
  useEffect(() => {
    onReturnRef.current = onReturn;
  }, [onReturn]);

  const clearPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fireReturn = useCallback(() => {
    clearPoll();
    leftAtRef.current = null;
    setState((prev) => {
      if (prev !== "waiting") return prev;
      onReturnRef.current?.();
      return "returned";
    });
  }, [clearPoll]);

  const hasBeenAwayLongEnough = useCallback(() => {
    const leftAt = leftAtRef.current;
    if (leftAt === null) return false;
    return Date.now() - leftAt >= minAwayMs;
  }, [minAwayMs]);

  /**
   * Opens the popup and starts watching.
   *
   * The window must already have been opened synchronously inside the click
   * handler (see `openPlaceholderWindow`), otherwise Safari and Firefox treat
   * the later, async navigation as an unsolicited popup and block it.
   */
  const startWatching = useCallback(
    (popup: Window | null) => {
      popupRef.current = popup;
      leftAtRef.current = Date.now();
      setState("waiting");

      clearPoll();

      // Popup-closed polling. Also covers the case where the popup was blocked
      // entirely: `popup` is null, and we simply rely on visibilitychange.
      if (popup) {
        pollRef.current = window.setInterval(() => {
          if (popup.closed) {
            clearPoll();
            // Closing the tab is an unambiguous "I'm done", so skip the
            // minimum-away gate here.
            fireReturn();
          }
        }, 500);
      }
    },
    [clearPoll, fireReturn],
  );

  const reset = useCallback(() => {
    clearPoll();
    popupRef.current = null;
    leftAtRef.current = null;
    setState("idle");
  }, [clearPoll]);

  /** Reopens the processor tab for a user who says "not yet". */
  const refocusPopup = useCallback((url: string) => {
    const existing = popupRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      return existing;
    }
    const reopened = window.open(url, "_blank", "noopener,noreferrer");
    popupRef.current = reopened;
    return reopened;
  }, []);

  useEffect(() => {
    if (state !== "waiting") return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Mark the moment they actually left. The popup may take a beat to
        // take focus, so this is more accurate than the click timestamp.
        leftAtRef.current = Date.now();
        return;
      }
      if (hasBeenAwayLongEnough()) fireReturn();
    };

    const onFocus = () => {
      if (hasBeenAwayLongEnough()) fireReturn();
    };

    // iOS Safari restores from bfcache without a visibilitychange.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && hasBeenAwayLongEnough()) fireReturn();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [state, hasBeenAwayLongEnough, fireReturn]);

  useEffect(() => clearPoll, [clearPoll]);

  return {
    state,
    startWatching,
    reset,
    refocusPopup,
    /** Lets the user skip ahead without waiting for a signal. */
    markReturned: fireReturn,
  };
}

/**
 * Opens a blank tab synchronously during the click event.
 *
 * Popup blockers key off user activation. By the time our `fetch` to
 * generate-link resolves, that activation has expired and `window.open` gets
 * blocked. So we claim the tab immediately and navigate it once we have the
 * URL. The interstitial is what the user sees for the ~200ms in between.
 */
export function openPlaceholderWindow(message = "Opening secure donation page…"): Window | null {
  const popup = window.open("", "_blank");
  if (!popup) return null;

  popup.document.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
       font:500 15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#334155;
       background:#f8fafc;text-align:center;padding:24px}
  .s{width:28px;height:28px;margin:0 auto 14px;border:3px solid #cbd5e1;
     border-top-color:#0f766e;border-radius:50%;animation:r .8s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.s{animation-duration:2s}}
</style></head>
<body><div><div class="s"></div>${message}</div></body></html>`);
  popup.document.close();

  return popup;
}
