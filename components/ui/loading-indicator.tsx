"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type LoadingIndicatorProps = {
  title: string;
  className?: string;
};

export function LoadingIndicator({ title, className }: LoadingIndicatorProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4 text-center", className)}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="relative h-12 w-12" aria-hidden>
        <span className="absolute inset-0 rounded-full border-2 border-primary/15" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary" />
        <span className="absolute inset-[10px] rounded-full bg-primary/10" />
      </div>

      <p className="text-[15px] font-semibold tracking-tight text-foreground">{title}</p>
    </div>
  );
}
