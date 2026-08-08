"use client";

import { useSyncExternalStore } from "react";

// Availability never changes during a session, so there's nothing to subscribe
// to; the no-op unsubscribe satisfies the store contract.
const subscribe = () => () => {};

/**
 * Whether the browser offers a native share sheet.
 *
 * Read through useSyncExternalStore rather than an effect so the server
 * snapshot is explicitly `false`. That gives a hydration-safe answer in one
 * render instead of flashing the wrong UI and correcting it afterwards.
 */
export function useNativeShareAvailable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof navigator !== "undefined" && "share" in navigator,
    () => false,
  );
}
