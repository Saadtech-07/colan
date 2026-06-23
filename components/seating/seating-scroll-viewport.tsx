"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  paddingClassName?: string;
  autoFocus?: boolean;
};

/**
 * Scroll container for the wide/tall seating floor plan.
 * Uses inline-block sizing so scrollWidth/scrollHeight match the full layout,
 * and forwards mouse-wheel deltas to this element (needed over transformed/zoomed children).
 */
export function SeatingScrollViewport({
  children,
  className,
  paddingClassName = "p-4 sm:p-8",
  autoFocus = false,
}: Props) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!autoFocus) return;
    scrollRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;

      const canScrollY = node.scrollHeight > node.clientHeight + 1;
      const canScrollX = node.scrollWidth > node.clientWidth + 1;
      if (!canScrollY && !canScrollX) return;

      if (!node.contains(event.target as Node)) return;

      let moved = false;

      if (canScrollY && event.deltaY !== 0) {
        const before = node.scrollTop;
        node.scrollTop += event.deltaY;
        moved = moved || node.scrollTop !== before;
      }

      const horizontalDelta =
        event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;

      if (canScrollX && horizontalDelta !== 0) {
        const before = node.scrollLeft;
        node.scrollLeft += horizontalDelta;
        moved = moved || node.scrollLeft !== before;
      }

      if (moved) {
        event.preventDefault();
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      role="region"
      aria-label="Seating floor plan scroll area"
      className={cn(
        "min-h-0 h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-auto scroll-smooth focus:outline-none",
        className,
      )}
    >
      <div
        className={cn(
          "box-border inline-block min-h-full min-w-full align-top",
          paddingClassName,
        )}
      >
        <div className="mx-auto w-max max-w-none">{children}</div>
      </div>
    </div>
  );
}
