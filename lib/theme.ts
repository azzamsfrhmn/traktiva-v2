"use client";

import { useSyncExternalStore } from "react";

// ponytail: replaces next-themes (its injected <script> trips React 19's dev warning). Two modes only.
export type Theme = "light" | "dark";
const KEY = "theme";
const EVENT = "traktiva:theme";

// Runs before paint from the root layout <head> so there is no flash of the wrong theme. Dark is the default;
// anything other than "light" (incl. an old "system" value) means dark.
export const THEME_INIT_SCRIPT = `(function(){try{var d=localStorage.getItem("${KEY}")!=="light";document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){document.documentElement.classList.add("dark")}})()`;

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Current theme; null during SSR/hydration (unknown on the server). */
export function useTheme(): Theme | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
