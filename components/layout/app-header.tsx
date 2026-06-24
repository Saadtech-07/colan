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
import { profileNameInitial, resolveProfileImageSrc } from "@/lib/profile-image";
import { resolveWorkspaceRoleLabelForChrome } from "@/lib/workspace-label";
import { cn } from "@/lib/utils";
import { useAppState } from "@/providers/app-state";
import { PageTitle } from "@/components/ui/page-typography";
import { NotificationBell } from "@/components/layout/notification-bell";

const PAGE_META: Array<{
  match: RegExp;
  title: string;
}> = [
  {
    match: /^\/dashboard$/,
    title: "Dashboard",
  },
  {
    match: /^\/projects$/,
    title: "Team Projects",
  },
  {
    match: /^\/projects\/new$/,
    title: "New project",
  },
  {
    match: /^\/projects\/.+$/,
    title: "Project details",
  },
  {
    match: /^\/team-members$/,
    title: "Team members",
  },
  {
    match: /^\/team-members\/.+$/,
    title: "Employee profile",
  },
  {
    match: /^\/chat$/,
    title: "Messages",
  },
  {
    match: /^\/gallery$/,
    title: "Gallery",
  },
  {
    match: /^\/seating$/,
    title: "Seating arrangement",
  },
  {
    match: /^\/roles$/,
    title: "Roles & access",
  },
  {
    match: /^\/app-users\/new$/,
    title: "Create account",
  },
  {
    match: /^\/app-users\/[^/]+\/edit$/,
    title: "Edit account",
  },
  {
    match: /^\/app-users$/,
    title: "App user",
  },
  {
    match: /^\/profile-settings$/,
    title: "Profile settings",
  },
];

function headerMetaForPath(pathname: string) {
  return (
    PAGE_META.find((item) => item.match.test(pathname)) ?? {
      title: "Colan Infotech",
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
  const { user, logout, sessionStatus, dataLoading } = useAppState();
  const { mobileOpen } = useSidebar();
  const pathname = usePathname();
  const pageMeta = headerMetaForPath(pathname);
  const isMobileViewport = React.useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    () => false,
  );
  const showPageMeta = isMobileViewport ? !mobileOpen : true;

  return (
    <header className="sticky top-0 z-20 flex h-14 min-h-14 items-center justify-between gap-2 border-b border-border/80 bg-background/95 px-3 backdrop-blur transition-colors duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] supports-[backdrop-filter]:bg-background/80 sm:h-[4.25rem] sm:gap-3 sm:px-6 lg:px-8">
      <div
        className={cn(
          "min-w-0 transition-all duration-motion ease-motion",
          showPageMeta
            ? "max-w-full opacity-100"
            : "pointer-events-none max-w-0 overflow-hidden opacity-0",
        )}
        aria-hidden={!showPageMeta}
      >
        <div className="min-w-0">
          <PageTitle
            key={pathname}
            as="p"
            className="truncate app-reveal-in"
          >
            {pageMeta.title}
          </PageTitle>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3">
        <NotificationBell />
        <ThemeToggle className="text-muted-foreground hover:text-foreground" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-9 gap-2 rounded-full border-border/80 pl-1 pr-2 hover:bg-accent/80 sm:h-10 sm:pr-3"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={resolveProfileImageSrc(user?.avatarUrl)}
                  alt={user?.name}
                />
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
                  {resolveWorkspaceRoleLabelForChrome(user?.appRole, {
                    sessionStatus,
                    dataLoading,
                  })}
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
