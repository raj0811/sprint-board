"use client";

import { useSyncExternalStore } from "react";

const EVENT = "orbit-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

const isDark = () => document.documentElement.classList.contains("dark");

/** True while the dark theme is active; updates when the user toggles it. */
export function useIsDark() {
  return useSyncExternalStore(subscribe, isDark, () => true);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Dark is the default, so the server renders the dark-mode state.
  const dark = useIsDark();

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* private mode */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#0f0e15" : "#f7f6fa");
    window.dispatchEvent(new Event(EVENT));
  }

  return <button type="button" onClick={toggle} className={`grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink ${className}`} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {dark
        ? <path d="M12 3v2m0 14v2M5.6 5.6 7 7m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
        : <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />}
    </svg>
  </button>;
}
