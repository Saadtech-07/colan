"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";
import { AuthGate } from "@/providers/app-state";
import { PageTransition } from "@/components/layout/page-transition";
import { cn } from "@/lib/utils";

function isFloorPlanBuilderRoute(pathname: string): boolean {
  return /\/seating\/floors\/(?:builder|[^/]+\/builder)\/?$/.test(pathname);
}

function DashboardShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  if (isFloorPlanBuilderRoute(pathname)) {
    return <div className="h-dvh w-full overflow-hidden bg-background">{children}</div>;
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-muted/30 transition-[padding,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "lg:pl-16" : "lg:pl-[14.5rem]",
      )}
    >
      <AppSidebar />
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-6 lg:p-8 lg:pb-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <SidebarProvider>
        <DashboardShellInner>{children}</DashboardShellInner>
      </SidebarProvider>
    </AuthGate>
  );
}
