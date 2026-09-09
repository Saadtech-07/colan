"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-session-provider";
import { SuperAdminSidebar } from "@/components/layout/super-admin-sidebar";
import { PageTransition } from "@/components/layout/page-transition";

export function PlatformGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (status === "unauthenticated" || session?.user?.accessLevel !== "platform") {
    return null;
  }

  return <>{children}</>;
}

export function SuperAdminShell({ children }: { children: ReactNode }) {
  return (
    <PlatformGate>
      <div className="min-h-screen bg-muted/20 pl-[14.5rem]">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-6 py-4 backdrop-blur">
          <p className="text-sm text-muted-foreground">Platform administration</p>
          <h1 className="text-lg font-semibold text-foreground">Colan Super Admin</h1>
        </header>
        <main className="p-6 lg:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <SuperAdminSidebar />
    </PlatformGate>
  );
}
