"use client";

import * as React from "react";
import { BuilderGridSeatTile } from "@/components/floor-plan-builder/builder-grid-seat-tile";
import { buildInternalGridStyle } from "@/components/floor-plan-builder/builder-ui";
import {
  CANVAS_BOUNDS_PX,
  CANVAS_DOT_SPACING,
  getWorldPixelRect,
  isFreeformSeat,
} from "@/lib/floor-plan-builder/freeform-geometry";
import { SeatingZoomFrame } from "@/components/seating/seating-zoom-frame";
import { getElementDefinition } from "@/lib/floor-plan-builder/element-registry";
import { getWorldFootprint } from "@/lib/floor-plan-builder/hierarchy";
import { elementPixelSize } from "@/lib/floor-plan-builder/metrics";
import {
  BUILDER_CELL_GAP,
  BUILDER_CELL_PX,
  BUILDER_CELL_STRIDE,
  type FloorPlanElement,
  type FloorPlanLayoutState,
} from "@/lib/floor-plan-builder/types";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types";

type Props = {
  layout: FloorPlanLayoutState;
  occupancy: Map<string, Employee>;
  selectedSeat: string | null;
  highlightSeats: Set<string> | null;
  teamFilter: string;
  search: string;
  viewMode: "all" | "occupied" | "available";
  canAssign: boolean;
  zoom: number;
  onSeatClick: (seatId: string) => void;
  onViewSeatHistory?: (seatId: string) => void;
  onAssignSeat: (seatId: string, employeeId: string) => void;
  onSwapSeats?: (fromSeatId: string, toSeatId: string) => void;
};

function StructureBlock({ element }: { element: FloorPlanElement }) {
  const def = getElementDefinition(element.type);
  const isSeat = element.type === "seat";

  if (isSeat) return null;

  return (
    <div
      className={cn(
        "absolute flex flex-col items-center justify-center overflow-hidden border-2 text-center shadow-sm",
        element.type === "seat" ? "rounded-[18px]" : "rounded-2xl",
        element.type === "pillar" &&
          "rounded-xl bg-gradient-to-b from-slate-600 to-slate-800 text-white shadow-md",
        element.type === "entrance" &&
          "rounded-xl bg-gradient-to-b from-sky-100 via-sky-50 to-sky-100 text-sky-900 shadow-md",
        element.type === "wall" && "rounded-md bg-slate-500 shadow-inner",
        def.category === "structure" &&
          element.type !== "pillar" &&
          element.type !== "entrance" &&
          "bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
      )}
      style={{
        width: element.width * BUILDER_CELL_PX + (element.width - 1) * BUILDER_CELL_GAP,
        height: element.height * BUILDER_CELL_PX + (element.height - 1) * BUILDER_CELL_GAP,
        borderColor: def.borderColor,
        backgroundColor:
          element.type === "pillar" || element.type === "entrance" || element.type === "wall"
            ? undefined
            : `${def.color}f0`,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      }}
    >
      {def.supportsChildren ? (
        <div
          className="pointer-events-none absolute inset-1 rounded-xl opacity-50"
          style={buildInternalGridStyle(def.borderColor)}
        />
      ) : null}
      {element.type === "pillar" ? (
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Pillar</span>
      ) : element.type === "entrance" ? (
        <span className="px-2 text-[10px] font-semibold uppercase tracking-wide">{element.name}</span>
      ) : element.type === "wall" ? (
        <span className="text-[9px] font-semibold uppercase tracking-wider text-white/90">Wall</span>
      ) : (
        <>
          <span className="relative z-10 px-2 text-[10px] font-bold uppercase tracking-wide text-foreground/85">
            {element.name}
          </span>
          <span className="relative z-10 text-[9px] text-muted-foreground">{def.label}</span>
        </>
      )}
    </div>
  );
}

export function BuilderFloorPlanView({
  layout,
  occupancy,
  selectedSeat,
  highlightSeats,
  teamFilter,
  search,
  viewMode,
  canAssign,
  zoom,
  onSeatClick,
  onViewSeatHistory,
  onAssignSeat,
  onSwapSeats,
}: Props) {
  const [dragEmployeeId, setDragEmployeeId] = React.useState<string | null>(null);
  const [dragSourceSeatId, setDragSourceSeatId] = React.useState<string | null>(null);

  const dimSeat = React.useCallback(
    (seatId: string, emp: Employee | null) => {
      if (viewMode === "occupied" && !emp) return true;
      if (viewMode === "available" && emp) return true;
      const hasFilter =
        teamFilter !== "All" || search.trim().length > 0 || highlightSeats !== null;
      if (!hasFilter) return false;
      if (highlightSeats !== null) return !highlightSeats.has(seatId);
      return !!emp;
    },
    [teamFilter, search, highlightSeats, viewMode],
  );

  const hideSeat = React.useCallback(
    (_seatId: string, emp: Employee | null) => {
      if (viewMode === "occupied" && !emp) return true;
      if (viewMode === "available" && emp) return true;
      return false;
    },
    [viewMode],
  );

  const canvasWidth = layout.grid.columns * CANVAS_BOUNDS_PX;
  const canvasHeight = layout.grid.rows * CANVAS_BOUNDS_PX;

  const seats = layout.elements.filter((el) => el.type === "seat" && el.seatId);
  const structures = layout.elements.filter((el) => el.type !== "seat");

  const sortedStructures = [...structures].sort((a, b) => {
    const depth = (el: FloorPlanElement) => (el.parentId ? 1 : 0);
    return depth(a) - depth(b);
  });

  return (
    <div className="w-max" data-seating-export-scene>
      <SeatingZoomFrame zoom={zoom}>
        <div
          className="relative rounded-[28px] border border-border/60 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          style={{ width: canvasWidth + 48, height: canvasHeight + 48 }}
        >
          <div
            className="relative rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]"
            style={{ width: canvasWidth, height: canvasHeight }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-[24px] opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(148,163,184,0.35) 1px, transparent 1px)",
                backgroundSize: `${CANVAS_DOT_SPACING}px ${CANVAS_DOT_SPACING}px`,
              }}
            />

            {sortedStructures.map((element) => {
              const world = getWorldFootprint(layout.elements, element);
              return (
                <div
                  key={element.id}
                  className="absolute"
                  style={{
                    left: world.worldColumn * BUILDER_CELL_STRIDE,
                    top: world.worldRow * BUILDER_CELL_STRIDE,
                  }}
                >
                  <StructureBlock element={element} />
                </div>
              );
            })}

            {seats.map((element) => {
              const seatId = element.seatId!;
              const emp = occupancy.get(seatId) ?? null;
              if (hideSeat(seatId, emp)) return null;
              const pixelRect = isFreeformSeat(element)
                ? getWorldPixelRect(layout.elements, element)
                : null;
              const world = getWorldFootprint(layout.elements, element);
              const size = pixelRect
                ? { width: pixelRect.width, height: pixelRect.height }
                : elementPixelSize(element.width, element.height);

              return (
                <div
                  key={element.id}
                  className="absolute"
                  style={{
                    left: pixelRect ? pixelRect.x : world.worldColumn * BUILDER_CELL_STRIDE,
                    top: pixelRect ? pixelRect.y : world.worldRow * BUILDER_CELL_STRIDE,
                    width: size.width,
                    height: size.height,
                    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                    transformOrigin: "center center",
                  }}
                >
                  <BuilderGridSeatTile
                    element={element}
                    seatId={seatId}
                    occupant={emp}
                    selected={selectedSeat === seatId}
                    highlighted={highlightSeats?.has(seatId) ?? false}
                    dimmed={dimSeat(seatId, emp)}
                    canAssign={canAssign}
                    onSelect={() => onSeatClick(seatId)}
                    onViewHistory={
                      onViewSeatHistory ? () => onViewSeatHistory(seatId) : undefined
                    }
                    onDragStart={(employeeId) => {
                      setDragEmployeeId(employeeId);
                      setDragSourceSeatId(seatId);
                    }}
                    onDrop={() => {
                      const employeeId = dragEmployeeId;
                      const sourceSeatId = dragSourceSeatId;
                      setDragEmployeeId(null);
                      setDragSourceSeatId(null);
                      if (!employeeId) return;
                      const targetOccupant = occupancy.get(seatId) ?? null;
                      if (
                        sourceSeatId &&
                        sourceSeatId !== seatId &&
                        targetOccupant &&
                        onSwapSeats
                      ) {
                        onSwapSeats(sourceSeatId, seatId);
                        return;
                      }
                      if (!targetOccupant) {
                        onAssignSeat(seatId, employeeId);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </SeatingZoomFrame>
    </div>
  );
}
