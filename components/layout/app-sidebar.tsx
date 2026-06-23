"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
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

const SIDEBAR_WIDTH_EXPANDED = "w-[14.5rem]";
const SIDEBAR_WIDTH_COLLAPSED = "w-16";

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
          "group flex items-center rounded-lg text-sm font-medium transition-all duration-motion ease-motion",
          collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-2.5 px-2.5 py-2.5",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 truncate transition-all duration-motion ease-motion",
            collapsed
              ? "pointer-events-none max-w-0 overflow-hidden opacity-0"
              : "opacity-100",
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
          className="pointer-events-none absolute left-full top-1/2 z-[60] ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar-accent px-2.5 py-1.5 text-xs font-medium text-sidebar-accent-foreground opacity-0 shadow-lg transition-opacity duration-motion ease-motion group-hover/nav:opacity-100"
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

  const handleCollapseToggle = React.useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setMobileOpen(false);
    } else {
      setCollapsed((c) => !c);
    }
  }, [setCollapsed, setMobileOpen]);

  const collapseAriaLabel = mobileOpen
    ? "Close menu"
    : collapsed
      ? "Expand sidebar"
      : "Collapse sidebar";

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-motion ease-motion",
          showExpandedChrome ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED,
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <header className="h-14 shrink-0 overflow-hidden border-b border-sidebar-border">
          {showExpandedChrome ? (
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex h-full items-center gap-2.5 px-2.5 transition-colors hover:bg-sidebar-accent/40"
              title="Go to Dashboard"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                <img
                  src={colanlogo.src}
                  alt="Colan Infotech"
                  className="h-6 w-auto shrink-0 object-contain"
                />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-[13px] font-semibold leading-tight tracking-tight">
                  COLAN INFOTECH
                </p>
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/55">
                  {workspaceSubtitle}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex h-full items-center justify-center px-2">
              <Link
                href="/dashboard"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 transition-colors hover:bg-sidebar-accent/80"
                title="Go to Dashboard"
              >
                <img
                  src={colanlogo.src}
                  alt="Colan Infotech"
                  className="h-6 w-auto shrink-0 object-contain"
                />
              </Link>
            </div>
          )}
        </header>

        <div
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden py-3",
            showExpandedChrome ? "px-2.5" : "px-2",
          )}
        >
          <nav className={cn("flex flex-col", showExpandedChrome ? "gap-1.5" : "gap-2")}>
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

        <div className="shrink-0 border-t border-sidebar-border">
          <button
            type="button"
            onClick={handleCollapseToggle}
            aria-label={collapseAriaLabel}
            title={collapseAriaLabel}
            className={cn(
              "flex w-full min-h-12 items-center text-xs font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              showExpandedChrome
                ? "justify-center gap-2 px-3 py-3.5"
                : "justify-center px-2 py-3.5",
            )}
          >
            {showExpandedChrome ? (
              mobileOpen ? (
                <>
                  <span className="lg:hidden">Close</span>
                  <X className="h-4 w-4 shrink-0 lg:hidden" />
                  <span className="hidden lg:inline">Collapse</span>
                  <ChevronLeft className="hidden h-4 w-4 shrink-0 lg:block" />
                </>
              ) : (
                <>
                  <span>Collapse</span>
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                </>
              )
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 transition-colors group-hover:bg-sidebar-accent/80"
                aria-hidden
              >
                <ChevronRight className="h-4 w-4 shrink-0" />
              </span>
            )}
          </button>
        </div>
      </aside>

      <div
        role="presentation"
        aria-hidden
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-motion ease-motion lg:hidden",
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
