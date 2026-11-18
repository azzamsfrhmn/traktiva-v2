"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

// Windows 11-style caption buttons for the frameless Electron window.
// Icons are drawn as 10px SVGs like the native ones (Segoe Fluent glyphs aren't available on every PC).
export function WindowControls({ compact = false }: { compact?: boolean }) {
  const isDesktop = useSyncExternalStore(noop, () => !!window.desktop?.window, () => false);
  const [s, setS] = useState<DesktopWindowState>({ maximized: false, fullscreen: false, focused: true });

  useEffect(() => {
    const w = window.desktop?.window;
    if (!w) return;
    w.state().then(setS).catch(() => {});
    return w.onState(setS);
  }, []);

  // In the title bar (compact) the buttons are always in the server HTML (the bar itself is CSS-hidden on web),
  // so they never pop in after hydration; window.desktop is only touched on click.
  if (!compact && !isDesktop) return null;
  const w = {
    minimize: () => window.desktop?.window.minimize(),
    toggleMaximize: () => window.desktop?.window.toggleMaximize(),
    toggleFullscreen: () => window.desktop?.window.toggleFullscreen(),
    close: () => window.desktop?.window.close(),
  };
  const btn = `grid h-full ${compact ? "w-[42px]" : "w-[46px]"} place-items-center text-foreground/80 transition-colors [app-region:no-drag] ${s.focused ? "" : "opacity-60"}`;

  return (
    <div className={`flex h-full shrink-0 self-stretch ${compact ? "" : "-mr-3 ml-1"}`} role="group" aria-label="Kontrol jendela">
      <button type="button" onClick={() => w.minimize()} className={`${btn} hover:bg-foreground/10`} aria-label="Minimalkan" title="Minimalkan">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5h10" stroke="currentColor" strokeWidth="1" /></svg>
      </button>
      <button
        type="button"
        onClick={() => (s.fullscreen ? w.toggleFullscreen() : w.toggleMaximize())}
        className={`${btn} hover:bg-foreground/10`}
        aria-label={s.fullscreen ? "Keluar layar penuh" : s.maximized ? "Pulihkan" : "Maksimalkan"}
        title={s.fullscreen ? "Keluar layar penuh (F11)" : s.maximized ? "Pulihkan" : "Maksimalkan"}
      >
        {s.maximized || s.fullscreen ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
            <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
            <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
            <rect x="0.5" y="0.5" width="9" height="9" rx="1" />
          </svg>
        )}
      </button>
      <button type="button" onClick={() => w.close()} className={`${btn} hover:bg-[#c42b1c] hover:text-white`} aria-label="Tutup" title="Tutup">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" /></svg>
      </button>
    </div>
  );
}
