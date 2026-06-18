"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  zoom: number;
  children: React.ReactNode;
  className?: string;
};

/** Scales children without leaving empty layout space from CSS transform. */
export function SeatingZoomFrame({ zoom, children, className }: Props) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;

    const update = () => {
      setSize({ width: node.offsetWidth, height: node.offsetHeight });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{
        width: size.width > 0 ? size.width * zoom : undefined,
        height: size.height > 0 ? size.height * zoom : undefined,
      }}
    >
      <div
        ref={innerRef}
        className="absolute left-0 top-0 w-max origin-top-left transition-transform duration-200 ease-out"
        style={{ transform: `scale(${zoom})` }}
      >
        {children}
      </div>
    </div>
  );
}
