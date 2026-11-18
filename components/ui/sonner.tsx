"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { useTheme } from "@/lib/theme";

// Compact, Linear-style toasts: one quiet line on the popover surface, a small colored status icon,
// hairline border and a soft shadow. Sits just above the bottom status bar; older toasts stack behind.

const Toaster = (props: ToasterProps) => {
  const theme = useTheme() ?? "dark";
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      offset={{ bottom: "calc(var(--statusbar-height) + 10px)", right: 14 }}
      mobileOffset={{ bottom: "calc(var(--statusbar-height) + 8px)" }}
      gap={6}
      visibleToasts={3}
      duration={4000}
      style={{ "--width": "320px" } as React.CSSProperties}
      icons={{
        success: <CircleCheck className="size-4 text-status-ok" />,
        error: <OctagonX className="size-4 text-destructive" />,
        warning: <TriangleAlert className="size-4 text-status-progress" />,
        info: <Info className="size-4 text-[#4ea7fc]" />,
        loading: <Loader2 className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group/toast flex w-(--width) items-center gap-2.5 rounded-lg border border-border/80 bg-popover px-3 py-2.5 text-popover-foreground shadow-[0_4px_16px_-4px_rgb(0_0_0/0.18),0_1px_3px_rgb(0_0_0/0.06)] dark:shadow-[0_6px_20px_-6px_rgb(0_0_0/0.6)]",
          icon: "m-0 grid size-4 shrink-0 place-items-center self-start mt-px",
          content: "min-w-0 flex-1",
          title: "text-[13px] leading-[18px] font-medium",
          description: "mt-0.5 text-xs leading-snug text-muted-foreground",
          actionButton:
            "h-6 shrink-0 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          cancelButton: "h-6 shrink-0 rounded-md px-2 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
