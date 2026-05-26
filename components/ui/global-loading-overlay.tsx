"use client";

import * as React from "react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";

export type GlobalLoadingOverlayProps = {
  open: boolean;
  title: string;
  description: string;
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
        "pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-transparent px-6",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      role="status"
      aria-labelledby="global-loading-title"
    >
      <div className="animate-in fade-in-0 zoom-in-95 duration-200">
        <div id="global-loading-title">
          <LoadingIndicator title={title} />
        </div>
      </div>
    </div>
  );
}
