"use client";

import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";

/** One button: shows the mode you'd switch to. */
export function ThemeToggle() {
  const theme = useTheme(); // null until hydrated
  const next = theme === "light" ? "dark" : "light";
  const label = next === "dark" ? "Mode gelap" : "Mode terang";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-lg border bg-background text-muted-foreground shadow-xs transition-colors hover:text-foreground"
    >
      {/* icon follows the html.dark class set before paint, so it is right on the first frame (no blank → icon flash) */}
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
