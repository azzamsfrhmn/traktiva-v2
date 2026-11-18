"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useState that survives navigation and refresh (per-device convenience: search boxes, filters).
 * Starts with `initial` on the server and the first client render (no hydration mismatch), then
 * restores the saved value right after mount. Storage errors (private mode, quota) are ignored.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const restored = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(`traktiva:${key}`);
        if (raw != null) setValue(JSON.parse(raw) as T);
      } catch {}
      restored.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [key]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(`traktiva:${key}`, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}
