"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";
import { AuthGate } from "@/providers/app-state";
import { PageTransition } from "@/components/layout/page-transition";
import { cn } from "@/lib/utils";

function DashboardShellInner({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "min-h-screen bg-muted/30 transition-[padding,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "lg:pl-24" : "lg:pl-64",
      )}
    >
      <AppSidebar />
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
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
