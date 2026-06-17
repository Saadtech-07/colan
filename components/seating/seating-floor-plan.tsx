"use client";

import * as React from "react";
import { SEATING_ROWS, type SeatingRowConfig } from "@/lib/seating-layout";
import { SeatingAiCanvas } from "@/components/seating/seating-ai-canvas";
import { SeatingLayoutCanvas } from "@/components/seating/seating-layout-canvas";
import { SeatingRowBlock } from "@/components/seating/seating-row-block";
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
  onSeatClick: (seatId: string) => void;
  onAssignSeat: (seatId: string, employeeId: string) => void;
};

export function SeatingFloorPlan({
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
  onSeatClick,
  onAssignSeat,
}: Props) {
  const [dragEmployeeId, setDragEmployeeId] = React.useState<string | null>(null);

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
      <div
        className="w-max origin-top transition-transform duration-200 ease-out"
        style={{
          width: generatedLayout.room.width * zoom,
          height: generatedLayout.room.height * zoom,
        }}
      >
        <SeatingAiCanvas
          layout={generatedLayout}
          occupancy={occupancy}
          selectedSeat={selectedSeat}
          zoom={zoom}
          onSeatClick={onSeatClick}
        />
      </div>
    );
  }

  if (layoutMode && layoutZones.length > 0) {
    return (
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
    );
  }

  return (
    <div
      className="w-max origin-top transition-transform duration-200 ease-out"
      style={{ transform: `scale(${zoom})` }}
    >
      <div className="mx-auto min-w-max rounded-[34px] border border-slate-200/90 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(248,250,252,0.9)_42%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_40px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
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
      </div>
    </div>
  );
}
