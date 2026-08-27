"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type LoadingIndicatorProps = {
  title: string;
  description?: string;
  className?: string;
};

export function LoadingIndicator({ title, description, className }: LoadingIndicatorProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-5 text-center", className)}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <svg
        className="h-14 w-14 animate-spin text-primary motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeDasharray="18 38"
        />
      </svg>

      <div className="space-y-1">
        <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
        {description ? (
          <p
            id="global-loading-description"
            className="max-w-xs text-sm text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
