import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConfirmHost } from "@/components/confirm-dialog";
import { RunHost } from "@/components/run-dialog";
import { Toaster } from "@/components/ui/sonner";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Traktiva",
  description: "Auto upload & AI content studio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" suppressHydrationWarning className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <head>
        {/* sets the dark class before first paint (server-rendered, so React doesn't warn) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* desktop app (preload exposes window.desktop before page scripts): reserve the title bar height before paint */}
        <script dangerouslySetInnerHTML={{ __html: "if(window.desktop)document.documentElement.classList.add('is-desktop')" }} />
      </head>
      <body className="min-h-full">
        {children}
        <Toaster />
        <ConfirmHost />
        <RunHost />
      </body>
    </html>
  );
}
