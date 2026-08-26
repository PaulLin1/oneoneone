"use client";

import { useSyncExternalStore } from "react";

// A tiny external store around the .dark class the no-flash script
// (app/layout.tsx) already set on <html> before hydration — useSyncExternalStore
// (not useState+useEffect) is what lets this read that DOM state without a
// hydration mismatch: getServerSnapshot below matches what the server always
// renders (it has no DOM to check), and React reconciles against the real
// client value right after mount on its own.
let listeners: (() => void)[] = [];
function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}
function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    listeners.forEach((l) => l());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      // Icon, not text — deliberately inconspicuous, a courtesy for the
      // rare visitor who wants to override the system preference the site
      // already follows by default, not a feature to advertise.
      className="flex items-center transition-colors hover:text-ink"
    >
      {isDark ? (
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
          <path
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.9 3.1l-1.06 1.06M4.16 11.84l-1.06 1.06M12.9 12.9l-1.06-1.06M4.16 4.16 3.1 3.1"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
          <path
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
            d="M14 9.8A6 6 0 1 1 6.2 2a4.7 4.7 0 0 0 7.8 7.8Z"
          />
        </svg>
      )}
    </button>
  );
}
