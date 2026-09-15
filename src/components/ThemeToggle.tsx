"use client";

import { useSyncExternalStore } from "react";

// Module-level listener set: the click handler notifies these directly after
// mutating the DOM attribute, so useSyncExternalStore knows to re-read the
// snapshot and re-render. There's only ever one ThemeToggle mounted, but this
// stays correct even if that changes.
const themeChangeListeners = new Set<() => void>();

function subscribeToTheme(onStoreChange: () => void) {
  themeChangeListeners.add(onStoreChange);
  return () => {
    themeChangeListeners.delete(onStoreChange);
  };
}

function getThemeSnapshot() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function getServerThemeSnapshot() {
  // The server can never know localStorage's value, so it always renders as
  // if the theme is light -- matching what the pre-paint script (which only
  // runs in the browser) leaves untouched on the very first server-rendered
  // markup.
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  function toggle() {
    const next = !isDark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing / storage disabled -- theme just won't persist.
    }
    for (const listener of themeChangeListeners) listener();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
