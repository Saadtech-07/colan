"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AlignmentGuideLine } from "@/lib/floor-plan-builder/alignment-guides";
import { CANVAS_DOT_SPACING } from "@/lib/floor-plan-builder/freeform-geometry";
import {
  BUILDER_CELL_PX,
  BUILDER_CELL_STRIDE,
} from "@/lib/floor-plan-builder/types";
import { cn } from "@/lib/utils";

export const BUILDER_CHROME = {
  shellBg: "bg-[#f4f6f8]",
  canvasBg: "bg-[#eef1f4]",
  canvasPattern:
    "radial-gradient(circle, rgba(148, 163, 184, 0.28) 1px, transparent 1px)",
  floorSheet:
    "rounded-[20px] border border-border/60 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.08)]",
  floorSheetActive:
    "ring-2 ring-primary/20 shadow-[0_12px_40px_rgba(59,130,246,0.12)]",
};

/** Subtle dotted background — visual guide only, not placement slots. */
export function buildCanvasGridStyle(_lineAlphaPercent = 5): React.CSSProperties {
  return {
    backgroundImage:
      "radial-gradient(circle, rgba(148, 163, 184, 0.38) 1px, transparent 1px)",
    backgroundSize: `${CANVAS_DOT_SPACING}px ${CANVAS_DOT_SPACING}px`,
  };
}

export function buildInternalGridStyle(borderColor: string): React.CSSProperties {
  return {
    backgroundImage: `
      radial-gradient(circle, ${borderColor}55 1px, transparent 1px),
      radial-gradient(circle, ${borderColor}33 1px, transparent 1px)
    `,
    backgroundSize: `${BUILDER_CELL_STRIDE}px ${BUILDER_CELL_STRIDE}px`,
    backgroundPosition: `${BUILDER_CELL_PX / 2}px ${BUILDER_CELL_PX / 2}px`,
  };
}

type DropCellHighlightProps = {
  worldRow: number;
  worldColumn: number;
  width: number;
  height: number;
  valid: boolean;
};

export function DropCellHighlight({
  worldRow,
  worldColumn,
  width,
  height,
  valid,
}: DropCellHighlightProps) {
  const cells: React.ReactNode[] = [];

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      cells.push(
        <div
          key={`${row}-${column}`}
          className={cn(
            "pointer-events-none absolute z-30 rounded-md",
            valid
              ? "bg-primary/10 ring-1 ring-inset ring-primary/25"
              : "bg-destructive/10 ring-1 ring-inset ring-destructive/25",
          )}
          style={{
            left: (worldColumn + column) * BUILDER_CELL_STRIDE,
            top: (worldRow + row) * BUILDER_CELL_STRIDE,
            width: BUILDER_CELL_PX,
            height: BUILDER_CELL_PX,
          }}
        />,
      );
    }
  }

  return <>{cells}</>;
}

type DimensionLabelProps = {
  width: number;
  height: number;
};

export function DimensionLabel({ width, height }: DimensionLabelProps) {
  return (
    <div className="pointer-events-none absolute -bottom-7 left-1/2 z-30 -translate-x-1/2 rounded-md bg-foreground px-2 py-0.5 text-[10px] font-semibold tabular-nums text-background shadow-sm">
      {width}×{height}
    </div>
  );
}

type SelectionBadgeProps = {
  label: string;
  sublabel?: string;
};

export function SelectionBadge({ label, sublabel }: SelectionBadgeProps) {
  return (
    <div className="pointer-events-none absolute -top-7 left-0 z-30 flex items-center gap-1.5">
      <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
        {label}
      </span>
      {sublabel ? (
        <span className="rounded-md bg-background/95 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground/70 shadow-sm ring-1 ring-border/50">
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}

type ToolbarGroupProps = {
  label: string;
  children: React.ReactNode;
};

export function ToolbarGroup({ label, children }: ToolbarGroupProps) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-border/40 bg-background/80 p-0.5 shadow-sm"
      aria-label={label}
      title={label}
    >
      {children}
    </div>
  );
}

type ToolIconButtonProps = {
  icon: LucideIcon;
  title: string;
  active?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
  onClick: () => void;
};

export function ToolIconButton({
  icon: Icon,
  title,
  active,
  disabled,
  size = "default",
  onClick,
}: ToolIconButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "rounded-md",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
      )}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
    </Button>
  );
}

type InspectorSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function InspectorSection({ title, description, children }: InspectorSectionProps) {
  return (
    <section>
      <div className="mb-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

type InspectorFieldProps = {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
};

export function InspectorField({ label, htmlFor, children }: InspectorFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

type AlignmentGuidesOverlayProps = {
  guides: AlignmentGuideLine[];
  columnOffset?: number;
  rowOffset?: number;
};

export function AlignmentGuidesOverlay({
  guides,
  columnOffset = 0,
  rowOffset = 0,
}: AlignmentGuidesOverlayProps) {
  if (!guides.length) return null;

  return (
    <>
      {guides.map((guide, index) => {
        const isCenter = guide.kind === "center";
        const strokeClass = isCenter ? "border-fuchsia-500/85" : "border-fuchsia-500/70";

        if (guide.pixel) {
          if (guide.axis === "vertical") {
            return (
              <div
                key={`v-${index}-${guide.position}`}
                className={cn(
                  "pointer-events-none absolute z-[45] border-l border-dashed",
                  strokeClass,
                )}
                style={{
                  left: guide.position,
                  top: guide.spanStart,
                  height: guide.spanEnd - guide.spanStart,
                }}
              />
            );
          }
          return (
            <div
              key={`h-${index}-${guide.position}`}
              className={cn(
                "pointer-events-none absolute z-[45] border-t border-dashed",
                strokeClass,
              )}
              style={{
                left: guide.spanStart,
                top: guide.position,
                width: guide.spanEnd - guide.spanStart,
              }}
            />
          );
        }

        if (guide.axis === "vertical") {
          const left = (guide.position + columnOffset) * BUILDER_CELL_STRIDE;
          const top = (guide.spanStart + rowOffset) * BUILDER_CELL_STRIDE;
          const height =
            (guide.spanEnd - guide.spanStart) * BUILDER_CELL_STRIDE + BUILDER_CELL_PX;
          return (
            <div
              key={`v-${index}-${guide.position}`}
              className={cn(
                "pointer-events-none absolute z-[45] border-l border-dashed",
                strokeClass,
              )}
              style={{ left, top, height }}
            />
          );
        }

        const top = (guide.position + rowOffset) * BUILDER_CELL_STRIDE;
        const left = (guide.spanStart + columnOffset) * BUILDER_CELL_STRIDE;
        const width =
          (guide.spanEnd - guide.spanStart) * BUILDER_CELL_STRIDE + BUILDER_CELL_PX;
        return (
          <div
            key={`h-${index}-${guide.position}`}
            className={cn(
              "pointer-events-none absolute z-[45] border-t border-dashed",
              strokeClass,
            )}
            style={{ left, top, width }}
          />
        );
      })}
    </>
  );
}

type SelectionMarqueeProps = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export function SelectionMarquee({ startX, startY, endX, endY }: SelectionMarqueeProps) {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  return (
    <div
      className="pointer-events-none absolute z-[60] rounded-sm border border-primary/70 bg-primary/8 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
      style={{ left, top, width, height }}
    />
  );
}
