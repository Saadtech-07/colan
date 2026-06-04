"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useSidebar } from "@/components/layout/sidebar-context";
import { profileNameInitial } from "@/lib/profile-image";
import { resolveWorkspaceRoleLabel } from "@/lib/workspace-label";
import { cn } from "@/lib/utils";
import { useAppState } from "@/providers/app-state";

const PAGE_META: Array<{
  match: RegExp;
  title: string;
  subtitle: string;
}> = [
  {
    match: /^\/dashboard$/,
    title: "Dashboard",
    subtitle: "Company-wide project pulse and team workload.",
  },
  {
    match: /^\/projects$/,
    title: "Team-based projects",
    subtitle: "Browse delivery work by squad and open a project to view details.",
  },
  {
    match: /^\/projects\/.+$/,
    title: "Project details",
    subtitle: "Review delivery status, members, and timeline information.",
  },
  {
    match: /^\/team-members$/,
    title: "Team members",
    subtitle: "Browse employees, roles, and workspace teams.",
  },
  {
    match: /^\/team-members\/.+$/,
    title: "Employee profile",
    subtitle: "View employee details, assignments, and project access.",
  },
  {
    match: /^\/gallery$/,
    title: "Gallery",
    subtitle: "Manage uploaded images and workspace highlights.",
  },
  {
    match: /^\/seating$/,
    title: "Seating arrangement",
    subtitle: "Manage floor plan seating, assignments, and capacity.",
  },
  {
    match: /^\/roles$/,
    title: "Roles & access",
    subtitle: "Manage workspace permissions and role policies.",
  },
  {
    match: /^\/app-users$/,
    title: "App account management",
    subtitle: "Create and manage login accounts for the workspace.",
  },
  {
    match: /^\/profile-settings$/,
    title: "Profile settings",
    subtitle: "Complete your first-login setup and secure your account.",
  },
];

function headerMetaForPath(pathname: string) {
  return (
    PAGE_META.find((item) => item.match.test(pathname)) ?? {
      title: "Colan Infotech",
      subtitle: "Employee and project workspace.",
    }
  );
}

function subscribeToMobileViewport(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(max-width: 1023px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getMobileViewportSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(max-width: 1023px)").matches;
}

export function AppHeader() {
  const { user, logout, dataLoading } = useAppState();
  const { collapsed, mobileOpen } = useSidebar();
  const pathname = usePathname();
  const pageMeta = headerMetaForPath(pathname);
  const isMobileViewport = React.useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    () => false,
  );
  const showPageMeta = isMobileViewport ? !mobileOpen : collapsed;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 lg:px-8">
      <div
        className={cn(
          "min-w-0 transition-all duration-300 ease-out",
          showPageMeta
            ? "max-w-full opacity-100"
            : "pointer-events-none max-w-0 overflow-hidden opacity-0",
        )}
        aria-hidden={!showPageMeta}
      >
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
            {pageMeta.title}
          </p>
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
            {pageMeta.subtitle}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle className="text-muted-foreground hover:text-foreground" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-10 gap-2 rounded-full border-border/80 pl-1 pr-3 hover:bg-accent/80"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                <AvatarFallback className="text-xs font-medium">
                  {profileNameInitial(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
                {user?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <span>{user?.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
                <Badge variant="secondary" className="w-fit">
                  {resolveWorkspaceRoleLabel(user?.appRole, dataLoading)}
                </Badge>
                {user?.team && (
                  <span className="text-xs text-muted-foreground">
                    {user.team}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile-settings">Profile settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
