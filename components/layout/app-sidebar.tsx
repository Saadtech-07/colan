"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Shield,
  MessageCircle,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { canAccessChat } from "@/lib/chat-access";
import { canAccessNav } from "@/lib/permissions";
import { formatWorkspaceSubtitle } from "@/lib/workspace-label";
import { useAppState } from "@/providers/app-state";
import { useChatUnread } from "@/providers/chat-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/layout/sidebar-context";
import colanlogo from "@/app/image/colanlogo2.png";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Team Projects", icon: Briefcase },
  { href: "/team-members", label: "Team Members", icon: Users },
  { href: "/chat", label: "Messages", icon: MessageCircle },
  { href: "/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/seating", label: "Seating Arrangement", icon: LayoutGrid },
  { href: "/roles", label: "Roles", icon: Shield },
  { href: "/app-users", label: "App Users", icon: UserCog },
] as const;

function SidebarNavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  badge?: number;
}) {
  return (
    <div className="group/nav relative">
      <Link
        href={href}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        className={cn(
          "group flex items-center rounded-xl text-sm font-medium transition-all duration-300 ease-out",
          collapsed ? "mx-auto h-11 w-11 justify-center" : "gap-3 px-3.5 py-2.5",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_10px_24px_rgba(2,6,23,0.18)]"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110" />
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 truncate transition-all duration-300 ease-out",
            collapsed
              ? "pointer-events-none max-w-0 overflow-hidden opacity-0 -translate-x-1"
              : "max-w-[180px] opacity-100 translate-x-0",
          )}
        >
          <span className="truncate">{label}</span>
          {!collapsed && badge && badge > 0 ? (
            <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </span>
      </Link>
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-[60] ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar-accent px-2.5 py-1.5 text-xs font-medium text-sidebar-accent-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover/nav:opacity-100"
        >
          {label}
        </span>
      )}
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { access, user, sessionStatus, dataLoading } = useAppState();
  const chatUnread = useChatUnread();

  const workspaceSubtitle = formatWorkspaceSubtitle(user?.appRole, {
    sessionStatus,
    dataLoading,
  });

  const visibleNav = nav.filter((item) => {
    if (!access) return false;
    if (item.href === "/chat") return canAccessChat(access.role);
    return canAccessNav(access.role, item.href);
  });

  const isDesktopCollapsed = collapsed;
  const showExpandedChrome = !isDesktopCollapsed || mobileOpen;

  const handleSidebarToggle = React.useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  }, [setCollapsed, setMobileOpen]);

  const toggleAriaLabel = mobileOpen
    ? "Close menu"
    : collapsed
      ? "Expand sidebar"
      : "Collapse sidebar";

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          showExpandedChrome ? "w-64" : "w-24",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <header className="h-16 shrink-0 overflow-hidden border-b border-sidebar-border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
          {showExpandedChrome ? (
            <div className="flex h-full items-center justify-between gap-3 px-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                  <img
                    src={colanlogo.src}
                    alt="Colan Infotech"
                    className="h-8 w-auto shrink-0 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                  <p className="truncate text-sm font-semibold leading-tight tracking-tight">
                    COLAN INFOTECH
                  </p>
                  <p className="truncate text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
                    {workspaceSubtitle}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="group h-9 w-9 shrink-0 rounded-xl border border-transparent bg-transparent text-sidebar-foreground/80 transition-all duration-300 hover:border-white/10 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
                onClick={handleSidebarToggle}
                aria-label={toggleAriaLabel}
              >
                {mobileOpen ? (
                  <X className="h-4 w-4 lg:hidden" />
                ) : (
                  <Menu className="h-4 w-4 transition-transform duration-300 group-hover:scale-105" />
                )}
              </Button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-3">
              <button
                type="button"
                className="group flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 shadow-sm transition-all duration-300 hover:bg-sidebar-accent/80 hover:ring-white/20"
                onClick={handleSidebarToggle}
                aria-label={toggleAriaLabel}
                title={toggleAriaLabel}
              >
                <img
                  src={colanlogo.src}
                  alt="Colan Infotech"
                  className="h-6 w-auto shrink-0 object-contain object-center transition-transform duration-300 group-hover:scale-105"
                />
              </button>
            </div>
          )}
        </header>

        <div
          className={cn(
            "flex-1 overflow-x-visible overflow-y-auto transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            showExpandedChrome ? "px-3 py-4" : "px-2.5 py-4",
          )}
        >
          <nav
            className={cn(
              "flex flex-col",
              showExpandedChrome ? "gap-1.5" : "gap-2",
            )}
          >
            {visibleNav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  (pathname.startsWith(item.href + "/") ||
                    pathname.startsWith(item.href)));
              return (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  collapsed={!showExpandedChrome}
                  onNavigate={() => setMobileOpen(false)}
                  badge={item.href === "/chat" ? chatUnread : undefined}
                />
              );
            })}
          </nav>
        </div>

        <Separator className="bg-sidebar-border" />
        <div
          className={cn(
            "shrink-0 overflow-hidden p-4 text-xs text-sidebar-foreground/60 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            showExpandedChrome ? "max-h-24 opacity-100" : "max-h-0 p-0 opacity-0",
          )}
        >
          MongoDB · NextAuth · Cloudinary — coming soon
        </div>
      </aside>

      <div
        role="presentation"
        aria-hidden
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
      />

      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="fixed bottom-4 left-4 z-50 h-11 w-11 rounded-full shadow-lg lg:hidden"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
    </>
  );
}
