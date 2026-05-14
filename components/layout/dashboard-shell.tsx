"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AuthGate } from "@/providers/app-state";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-muted/30 lg:pl-64">
        <AppSidebar />
        <div className="flex min-h-screen flex-col">
          <AppHeader />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}
