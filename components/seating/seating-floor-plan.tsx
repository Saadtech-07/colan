"use client";

import * as React from "react";
import { SEATING_ROWS } from "@/lib/seating-layout";
import { SeatingRowBlock } from "@/components/seating/seating-row-block";
import type { Employee } from "@/types";

type Props = {
  occupancy: Map<string, Employee>;
  selectedSeat: string | null;
  highlightSeats: Set<string> | null;
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
      const hasFilter = teamFilter !== "All" || search.trim().length > 0;
      if (!hasFilter) return false;
      if (highlightSeats && highlightSeats.size > 0) {
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

  return (
    <div
      className="w-max origin-top transition-transform duration-200 ease-out"
      style={{ transform: `scale(${zoom})` }}
    >
      <div className="mx-auto min-w-max rounded-[34px] border border-slate-300/35 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_rgba(255,255,255,0)_24%),linear-gradient(180deg,_#5078ad_0%,_#46699b_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_22px_54px_rgba(15,23,42,0.24)] sm:p-8 lg:p-10">
        {SEATING_ROWS.map((row) => (
          <div key={row.key} data-row={row.key} className="w-max">
            <SeatingRowBlock
              top={row.top}
              bottom={row.bottom}
              occupancy={occupancy}
              selectedSeat={selectedSeat}
              highlightSeats={highlightSeats}
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
