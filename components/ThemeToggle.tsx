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
      // Fixed black/yellow, not the flip-prone ink/paper tokens — this chip
      // sits on the masthead's always-yellow bar, same reasoning as the
      // Archive/Account chips beside it (see the comment in Masthead.tsx).
      className="-my-2 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-yellow transition-opacity hover:opacity-70 sm:px-3 sm:text-xs bg-black"
    >
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
