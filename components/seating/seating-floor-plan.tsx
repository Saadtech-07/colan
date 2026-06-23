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
import { CABINS_AFTER_G_ROW, CABINS_BEFORE_A_ROW, type SeatingCabin } from "@/lib/seating-cabins";
import type { SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import type { GeneratedSeatingLayout } from "@/lib/seating-layout-types";
import type { SeatingAiZone } from "@/lib/seating-ai-types";
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
  onSeatClick: (seatId: string) => void;
  onAssignSeat: (seatId: string, employeeId: string) => void;
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
      onSeatClick,
      onAssignSeat,
    },
    ref,
  ) {
  const [dragEmployeeId, setDragEmployeeId] = React.useState<string | null>(null);
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
          {showCabins && <SeatingSideCabins sideCabins={sideCabins} />}
          <div className="min-w-0">
            {showCabins && (
              <SeatingCabinRow cabins={cabinsBeforeA} className="mb-6" />
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
                    if (dragEmployeeId) {
                      onAssignSeat(seatId, dragEmployeeId);
                      setDragEmployeeId(null);
                    }
                  }}
                  dragEmployeeId={dragEmployeeId}
                  onDragStart={(id) => setDragEmployeeId(id)}
                />
              </div>
            ))}
            {showCabins && (
              <SeatingCabinRow cabins={cabinsAfterG} className="mt-2" />
            )}
          </div>
        </div>
      </SeatingFloor3DScene>
      </SeatingZoomFrame>
    </div>
  );
},
);
