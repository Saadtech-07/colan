"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  paddingClassName?: string;
  autoFocus?: boolean;
  /**
   * Fit layout to the viewport width and allow only vertical scrolling.
   * Prevents horizontal overflow on laptops / small desktops (View + main canvas).
   */
  fitWidth?: boolean;
};

/**
 * Scroll container for the seating floor plan.
 * `fitWidth` scales content to the container width so left→right bays stay on screen.
 */
export function SeatingScrollViewport({
  children,
  className,
  paddingClassName = "p-4 sm:p-8",
  autoFocus = false,
  fitWidth = false,
}: Props) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [natural, setNatural] = React.useState({ width: 0, height: 0 });
  const [offsetX, setOffsetX] = React.useState(0);

  React.useEffect(() => {
    if (!autoFocus) return;
    scrollRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  React.useLayoutEffect(() => {
    if (!fitWidth) {
      setScale(1);
      setOffsetX(0);
      return;
    }

    const frame = frameRef.current;
    const measure = measureRef.current;
    if (!frame || !measure) return;

    const update = () => {
      const available = frame.clientWidth;
      const width = measure.offsetWidth;
      const height = measure.offsetHeight;
      setNatural({ width, height });
      if (width <= 0 || available <= 0) {
        setScale(1);
        setOffsetX(0);
        return;
      }
      const nextScale = Math.min(1, available / width);
      setScale(nextScale);
      setOffsetX(Math.max(0, (available - width * nextScale) / 2));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(frame);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [fitWidth, children]);

  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const EDGE_PX = 72;
    const SCROLL_STEP = 18;
    let frame = 0;

    const onDragOver = (event: DragEvent) => {
      if (!node.contains(event.target as Node) && event.target !== node) {
        // Still allow scrolling when dragging over scaled children.
        const rect = node.getBoundingClientRect();
        if (
          event.clientY < rect.top ||
          event.clientY > rect.bottom ||
          event.clientX < rect.left ||
          event.clientX > rect.right
        ) {
          return;
        }
      }

      const rect = node.getBoundingClientRect();
      let deltaY = 0;
      let deltaX = 0;

      if (event.clientY < rect.top + EDGE_PX) {
        deltaY = -SCROLL_STEP;
      } else if (event.clientY > rect.bottom - EDGE_PX) {
        deltaY = SCROLL_STEP;
      }

      if (!fitWidth) {
        if (event.clientX < rect.left + EDGE_PX) {
          deltaX = -SCROLL_STEP;
        } else if (event.clientX > rect.right - EDGE_PX) {
          deltaX = SCROLL_STEP;
        }
      }

      if (deltaY === 0 && deltaX === 0) return;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (deltaY) node.scrollTop += deltaY;
        if (deltaX) node.scrollLeft += deltaX;
      });
    };

    node.addEventListener("dragover", onDragOver);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("dragover", onDragOver);
    };
  }, [fitWidth]);

  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;

      const canScrollY = node.scrollHeight > node.clientHeight + 1;
      const canScrollX = !fitWidth && node.scrollWidth > node.clientWidth + 1;
      if (!canScrollY && !canScrollX) return;
      if (!node.contains(event.target as Node)) return;

      let moved = false;

      if (canScrollY && event.deltaY !== 0) {
        const before = node.scrollTop;
        node.scrollTop += event.deltaY;
        moved = moved || node.scrollTop !== before;
      }

      if (!fitWidth) {
        const horizontalDelta =
          event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;

        if (canScrollX && horizontalDelta !== 0) {
          const before = node.scrollLeft;
          node.scrollLeft += horizontalDelta;
          moved = moved || node.scrollLeft !== before;
        }
      }

      if (moved) {
        event.preventDefault();
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [fitWidth]);

  const scaledHeight = natural.height > 0 ? natural.height * scale : undefined;

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      role="region"
      aria-label="Seating floor plan scroll area"
      className={cn(
        "min-h-0 h-0 flex-1 overscroll-auto scroll-smooth focus:outline-none",
        fitWidth ? "overflow-x-hidden overflow-y-auto" : "overflow-x-auto overflow-y-auto",
        className,
      )}
    >
      <div
        ref={frameRef}
        className={cn(
          "box-border min-h-full align-top",
          fitWidth ? "w-full" : "inline-block min-w-full",
          paddingClassName,
        )}
      >
        {fitWidth ? (
          <div className="relative w-full" style={{ height: scaledHeight }}>
            <div
              ref={measureRef}
              className="absolute top-0 w-max origin-top-left will-change-transform"
              style={{
                left: offsetX,
                transform: `scale(${scale})`,
              }}
            >
              {children}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-max max-w-none">{children}</div>
        )}
      </div>
    </div>
  );
}
