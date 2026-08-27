"use client";

import * as React from "react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";
import { useAppState } from "@/providers/app-state";

export type PageLoadingShellProps = {
  loading: boolean;
  title: string;
  description?: string;
  /** Reserved height so the overlay centers over the page body while loading. */
  minLoadingHeight?: string;
  /** Wait for session + workspace bootstrap before showing this page loader. */
  deferWhileWorkspaceBootstrapping?: boolean;
  /** Center the loader in the main content area (roles / app users). */
  centerInSection?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function PageLoadingShell({
  loading,
  title,
  description,
  minLoadingHeight = "320px",
  deferWhileWorkspaceBootstrapping = false,
  centerInSection = false,
  className,
  children,
}: PageLoadingShellProps) {
  const { dataLoading, sessionStatus } = useAppState();

  const workspaceBootstrapping =
    deferWhileWorkspaceBootstrapping &&
    (sessionStatus === "loading" || dataLoading);
  const visibleLoading = loading && !workspaceBootstrapping;

  return (
    <div
      className={cn(
        "relative",
        centerInSection && visibleLoading && "min-h-[calc(100dvh-8rem)]",
        className,
      )}
    >
      <div
        className={cn(
          "transition-[filter,opacity] duration-200",
          visibleLoading && "pointer-events-none select-none blur-[4px] opacity-55",
        )}
        aria-hidden={visibleLoading}
      >
        {children}
        {visibleLoading ? <div aria-hidden style={{ minHeight: minLoadingHeight }} /> : null}
      </div>

      {visibleLoading ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          aria-busy="true"
          aria-live="polite"
          role="status"
        >
          <LoadingIndicator title={title} description={description} />
        </div>
      ) : null}
    </div>
  );
}
