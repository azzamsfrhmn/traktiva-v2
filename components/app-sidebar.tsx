"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCard, type UserInfo } from "@/components/user-card";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAV, NAV_GROUPS, type NavCounts, type NavItem } from "@/lib/nav";

function NavItems({ items, counts }: { items: readonly NavItem[]; counts: NavCounts }) {
  const pathname = usePathname();
  return (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => {
        // the Studio (/video/<id>) belongs to Proyek Video, not to the concept gallery
        const path = /^\/video\/\d+/.test(pathname) ? "/proyek" : pathname;
        const active = path === `/${item.slug}` || path.startsWith(`/${item.slug}/`);
        return (
          <SidebarMenuItem key={item.slug}>
            <SidebarMenuButton
              isActive={active}
              className="h-8 gap-2.5 text-[13px] text-sidebar-foreground/85 data-active:font-medium data-active:text-sidebar-foreground"
              render={<Link href={`/${item.slug}`} />}
            >
              <item.icon className="size-4" style={{ color: item.color }} />
              <span className="truncate">{item.title}</span>
            </SidebarMenuButton>
            {!!counts[item.slug] && (
              <SidebarMenuBadge className="rounded bg-sidebar-accent px-1.5 text-[11px] text-muted-foreground">{counts[item.slug]}</SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function Group({ name, counts, className = "" }: { name: (typeof NAV_GROUPS)[number]; counts: NavCounts; className?: string }) {
  const items = NAV.filter((n) => n.group === name);
  return (
    <SidebarGroup className={`px-2 py-1.5 ${className}`}>
      {/* "Utama" holds only Beranda; a label would just add noise */}
      {name !== "Utama" && <SidebarGroupLabel className="h-6 px-2 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">{name}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <NavItems items={items} counts={counts} />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// Always-open sidebar (no collapse): every menu stays visible, grouped by workflow.
// Settings sit at the bottom next to the user card, away from daily work.
export function AppSidebar({ counts = {}, user, className }: { counts?: NavCounts; user: UserInfo; className?: string }) {
  return (
    <Sidebar collapsible="none" className={`shrink-0 border-r border-sidebar-border ${className ?? ""}`}>
      <SidebarContent className="gap-0 py-1">
        {NAV_GROUPS.filter((g) => g !== "Pengaturan").map((g) => (
          <Group key={g} name={g} counts={counts} />
        ))}
        <Group name="Pengaturan" counts={counts} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <UserCard info={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
