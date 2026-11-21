"use client";

import { useCallback, useSyncExternalStore } from "react";

// A tiny localStorage-backed preference store for UI state (sidebar, column widths).
// The server snapshot is always null, so the first render matches the server and the
// saved value is applied right after hydration.

const EVENT = "orbit-pref-change";

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** The raw stored string for `key` (null when unset) and a setter that persists it. */
export function useStoredString(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => null);
  const set = useCallback((next: string | null) => {
    try {
      if (next === null) localStorage.removeItem(key);
      else localStorage.setItem(key, next);
    } catch { /* private mode */ }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return [value, set];
}
