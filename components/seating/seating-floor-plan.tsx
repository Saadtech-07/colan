"use client";

import * as React from "react";
import { SEATING_ROWS, type SeatingRowConfig } from "@/lib/seating-layout";
import {
  SeatingAiCanvas,
  type SeatingAiCanvasHandle,
} from "@/components/seating/seating-ai-canvas";
import { SeatingLayoutCanvas } from "@/components/seating/seating-layout-canvas";
import { SeatingFloor3DScene } from "@/components/seating/seating-3d";
import { SeatingCabinRow } from "@/components/seating/seating-cabin-row";
import { SeatingSideCabins } from "@/components/seating/seating-side-cabins";
import { SeatingRowBlock } from "@/components/seating/seating-row-block";
import { SeatingZoomFrame } from "@/components/seating/seating-zoom-frame";
import { SeatingStructuralBlock } from "@/components/seating/seating-3d";
import { CABINS_AFTER_G_ROW, CABINS_BEFORE_A_ROW, type SeatingCabin } from "@/lib/seating-cabins";
import type { SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import type { GeneratedSeatingLayout } from "@/lib/seating-layout-types";
import type { SeatingAiZone } from "@/lib/seating-ai-types";
import {
  CELL_GAP,
  LABEL_WIDTH,
  ROW_AISLE_MARGIN,
  SEAT_HEIGHT,
  SEAT_WIDTH,
} from "@/lib/seating-layout-metrics";
import type { Employee } from "@/types";

type Props = {
  occupancy: Map<string, Employee>;
  selectedSeat: string | null;
  highlightSeats: Set<string> | null;
  rows?: SeatingRowConfig[];
  layoutMode?: boolean;
  generatedLayout?: GeneratedSeatingLayout | null;
  layoutSeats?: Set<string> | null;
  layoutZones?: SeatingAiZone[];
  zoneBySeat?: Map<string, string>;
  teamFilter: string;
  search: string;
  viewMode: "all" | "occupied" | "available";
  canAssign: boolean;
  zoom: number;
  showCabins?: boolean;
  cabinsBeforeA?: SeatingCabin[];
  cabinsAfterG?: SeatingCabin[];
  sideCabins?: SideCabinsConfig;
  /** Compact entrance outside seating bays (not in a row). */
  outsideEntrance?: { text: string } | null;
  cabinOccupancy?: Map<string, Employee>;
  selectedCabinId?: string | null;
  onCabinClick?: (cabinId: string) => void;
  onSeatClick: (seatId: string) => void;
  onAssignSeat: (seatId: string, employeeId: string) => void;
  /** Drag an occupied seat onto another occupied seat to swap. */
  onSwapSeats?: (fromSeatId: string, toSeatId: string) => void;
};

export type SeatingFloorPlanHandle = {
  getLayoutCanvas: () => HTMLCanvasElement | null;
  getFloorPlanElement: () => HTMLDivElement | null;
};

export const SeatingFloorPlan = React.forwardRef<SeatingFloorPlanHandle, Props>(
  function SeatingFloorPlan(
    {
      occupancy,
      selectedSeat,
      highlightSeats,
      rows = SEATING_ROWS,
      layoutMode = false,
      generatedLayout = null,
      layoutSeats = null,
      layoutZones = [],
      zoneBySeat = new Map(),
      teamFilter,
      search,
      viewMode,
      canAssign,
      zoom,
      showCabins = true,
      cabinsBeforeA = CABINS_BEFORE_A_ROW,
      cabinsAfterG = CABINS_AFTER_G_ROW,
      sideCabins,
      outsideEntrance = null,
      cabinOccupancy,
      selectedCabinId = null,
      onCabinClick,
      onSeatClick,
      onAssignSeat,
      onSwapSeats,
    },
    ref,
  ) {
  const [dragEmployeeId, setDragEmployeeId] = React.useState<string | null>(null);
  const [dragSourceSeatId, setDragSourceSeatId] = React.useState<string | null>(null);
  const aiCanvasRef = React.useRef<SeatingAiCanvasHandle>(null);
  const exportRootRef = React.useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => ({
    getLayoutCanvas: () => aiCanvasRef.current?.getCanvas() ?? null,
    getFloorPlanElement: () =>
      exportRootRef.current?.querySelector<HTMLDivElement>("[data-seating-export-scene]") ??
      exportRootRef.current,
  }));

  const dimSeat = React.useCallback(
    (seatId: string, emp: Employee | null) => {
      if (viewMode === "occupied" && !emp) return true;
      if (viewMode === "available" && emp) return true;
      const hasFilter =
        teamFilter !== "All" || search.trim().length > 0 || highlightSeats !== null;
      if (!hasFilter) return false;
      if (highlightSeats !== null) {
        return !highlightSeats.has(seatId);
      }
      return !!emp;
    },
    [teamFilter, search, highlightSeats, viewMode],
  );

  const hideSeat = React.useCallback(
    (seatId: string, emp: Employee | null) => {
      if (viewMode === "occupied" && !emp) return true;
      if (viewMode === "available" && emp) return true;
      return false;
    },
    [viewMode],
  );

  /** Match horizontal cabins to the first row’s top seat count (A1–A8 = 8, A1–A16 = 16). */
  const cabinSeatSpan = React.useMemo(() => {
    const first = rows[0];
    if (!first) return 16;
    const topSeats = first.top.filter((cell) => cell.kind === "seat").length;
    return topSeats > 0 ? topSeats : 16;
  }, [rows]);

  if (layoutMode && generatedLayout) {
    return (
      <div ref={exportRootRef} className="w-max">
        <SeatingZoomFrame zoom={zoom}>
          <SeatingAiCanvas
            ref={aiCanvasRef}
            layout={generatedLayout}
            occupancy={occupancy}
            selectedSeat={selectedSeat}
            onSeatClick={onSeatClick}
          />
        </SeatingZoomFrame>
      </div>
    );
  }

  if (layoutMode && layoutZones.length > 0) {
    return (
      <div ref={exportRootRef} className="w-max">
        <SeatingLayoutCanvas
          zones={layoutZones}
          occupancy={occupancy}
          zoneBySeat={zoneBySeat}
          selectedSeat={selectedSeat}
          canAssign={canAssign}
          zoom={zoom}
          onSeatClick={onSeatClick}
          onAssignSeat={onAssignSeat}
        />
      </div>
    );
  }

  return (
    <div ref={exportRootRef} className="w-max" data-seating-export-root>
      <SeatingZoomFrame zoom={zoom} className="pb-6">
      <SeatingFloor3DScene>
        <div className="flex w-max items-start gap-3 overflow-visible">
          {showCabins && (
            <SeatingSideCabins
              sideCabins={sideCabins}
              rowCount={rows.length}
              cabinOccupancy={cabinOccupancy}
              selectedCabinId={selectedCabinId}
              canAssign={canAssign}
              onCabinClick={onCabinClick}
            />
          )}
          <div className="min-w-0">
            {showCabins && (
              <SeatingCabinRow
                cabins={cabinsBeforeA}
                seatSpan={cabinSeatSpan}
                className="mb-6"
                cabinOccupancy={cabinOccupancy}
                selectedCabinId={selectedCabinId}
                canAssign={canAssign}
                onCabinClick={onCabinClick}
              />
            )}
            {rows.map((row) => (
              <div key={row.key} data-row={row.key} className="w-max">
                <SeatingRowBlock
                  top={row.top}
                  bottom={row.bottom}
                  occupancy={occupancy}
                  selectedSeat={selectedSeat}
                  highlightSeats={highlightSeats}
                  layoutMode={layoutMode}
                  layoutSeats={layoutSeats}
                  zoneBySeat={zoneBySeat}
                  dimSeat={dimSeat}
                  hideSeat={hideSeat}
                  canAssign={canAssign}
                  onSeatClick={onSeatClick}
                  onSeatDrop={(seatId) => {
                    if (!dragEmployeeId || !dragSourceSeatId) return;
                    if (seatId === dragSourceSeatId) {
                      setDragEmployeeId(null);
                      setDragSourceSeatId(null);
                      return;
                    }
                    const targetOcc = occupancy.get(seatId) ?? null;
                    if (targetOcc && onSwapSeats) {
                      onSwapSeats(dragSourceSeatId, seatId);
                    } else if (!targetOcc) {
                      onAssignSeat(seatId, dragEmployeeId);
                    } else if (targetOcc && !onSwapSeats) {
                      // Swap requested but handler missing — still move into seat via assign
                      // would displace target without relocating them; skip.
                    }
                    setDragEmployeeId(null);
                    setDragSourceSeatId(null);
                  }}
                  dragEmployeeId={dragEmployeeId}
                  onDragStart={(id) => {
                    setDragEmployeeId(id);
                    let source: string | null = null;
                    for (const [seat, emp] of occupancy) {
                      if (emp.id === id) {
                        source = seat;
                        break;
                      }
                    }
                    setDragSourceSeatId(source);
                  }}
                />
              </div>
            ))}
            {showCabins && outsideEntrance ? (
              <div
                className="flex w-max items-stretch"
                style={{
                  marginBottom: ROW_AISLE_MARGIN,
                  paddingLeft: LABEL_WIDTH,
                }}
              >
                <SeatingStructuralBlock
                  variant="entrance"
                  width={SEAT_WIDTH * 5 + CELL_GAP * 4}
                  height={SEAT_HEIGHT}
                >
                  <span className="text-[10px] font-bold uppercase leading-tight tracking-[0.2em] text-sky-800">
                    {outsideEntrance.text}
                  </span>
                </SeatingStructuralBlock>
              </div>
            ) : null}
            {showCabins && (
              <SeatingCabinRow
                cabins={cabinsAfterG}
                seatSpan={cabinSeatSpan}
                className="mt-2"
                cabinOccupancy={cabinOccupancy}
                selectedCabinId={selectedCabinId}
                canAssign={canAssign}
                onCabinClick={onCabinClick}
              />
            )}
          </div>
        </div>
      </SeatingFloor3DScene>
      </SeatingZoomFrame>
    </div>
  );
},
);
