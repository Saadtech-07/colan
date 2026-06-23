"use client";

import * as React from "react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";

export type GlobalLoadingOverlayProps = {
  open: boolean;
  title: string;
  className?: string;
};

export function GlobalLoadingOverlay({
  open,
  title,
  className,
}: GlobalLoadingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center bg-background/25 px-6 backdrop-blur-md",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      role="status"
      aria-labelledby="global-loading-title"
    >
      <div className="app-reveal-scale">
        <div id="global-loading-title">
          <LoadingIndicator title={title} />
        </div>
      </div>
    </div>
  );
}
