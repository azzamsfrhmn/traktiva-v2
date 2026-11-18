"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { WindowControls } from "@/components/window-controls";
import { navBySlug } from "@/lib/nav";

// Desktop-only title bar (frameless Electron window): a thin strip ABOVE the app navbar, like VS Code.
// It is part of the server HTML from the first paint and shown/hidden purely by CSS (html.is-desktop is set
// by an inline script before paint), so nothing pops in or shifts on reload. Web mode never shows it.
export function TitleBar() {
  const pathname = usePathname();
  const slug = /^\/video\/\d+/.test(pathname) ? "proyek" : pathname.split("/")[1] ?? "";
  const page = navBySlug(slug)?.title;

  return (
    <div className="titlebar app-drag relative h-(--titlebar-height) w-full shrink-0 select-none items-center border-b border-sidebar-border bg-background pl-3 text-[11px] text-muted-foreground">
      <Logo className="size-3.5" />
      <span className="ml-2 font-semibold text-foreground/80">Traktiva</span>
      {/* page title centered on the window, like native apps */}
      {page && <span className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[50%] truncate text-center font-medium text-foreground/70">{page}</span>}
      <div className="ml-auto flex h-full items-stretch">
        <WindowControls compact />
      </div>
    </div>
  );
}
