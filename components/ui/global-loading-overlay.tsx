"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
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
  description,
  className,
}: GlobalLoadingOverlayProps) {
  const [entered, setEntered] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-md transition-opacity duration-300",
        entered ? "opacity-100" : "opacity-0",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      role="alertdialog"
      aria-labelledby="global-loading-title"
      aria-describedby="global-loading-desc"
    >
      <div
        className={cn(
          "relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-card/95 p-8 shadow-2xl ring-1 ring-white/5 transition-all duration-300 ease-out",
          entered ? "scale-100 opacity-100" : "scale-[0.96] opacity-0",
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent"
          aria-hidden
        />

        <div className="relative flex flex-col items-center text-center">
          <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-75" />
            <span className="absolute inset-2 animate-pulse rounded-full bg-primary/10" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/5 shadow-inner">
              <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
            </div>
          </div>

          <h2
            id="global-loading-title"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            {title}
          </h2>
          <p
            id="global-loading-desc"
            className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground"
          >
            {description}
          </p>

          <div className="mt-6 flex gap-1.5" aria-hidden>
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
          </div>

          <div
            className="mt-6 h-1 w-full overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            <div className="h-full w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-primary/70" />
          </div>
        </div>
      </div>
    </div>
  );
}
