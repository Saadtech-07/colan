"use client";

import { TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  message: string | null;
  onDismiss: () => void;
  title?: string;
  /** `inline` renders inside a panel (e.g. create-account sidebar). */
  variant?: "fixed" | "inline";
};

export function TransientWarningToast({
  message,
  onDismiss,
  title = "Could not continue",
  variant = "fixed",
}: Props) {
  if (!message) return null;

  const card = (
    <div
      className={cn(
        "pointer-events-auto w-full rounded-2xl border border-amber-500/35 bg-card p-4 shadow-xl",
        "animate-in fade-in slide-in-from-top-2 duration-200",
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-amber-500/10 p-2 text-amber-600">
          <TriangleAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={onDismiss}
          aria-label="Dismiss warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  if (variant === "inline") {
    return <div className="mb-4">{card}</div>;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[200] flex justify-center px-4 sm:top-24">
      <div className="pointer-events-auto w-full max-w-md">{card}</div>
    </div>
  );
}
