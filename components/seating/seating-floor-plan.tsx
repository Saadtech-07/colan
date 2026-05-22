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
      className="origin-top-left transition-transform duration-200"
      style={{ transform: `scale(${zoom})` }}
    >
      <div className="min-w-[1100px] rounded-lg bg-[#4a6fa5] p-4 shadow-inner sm:p-6">
        {SEATING_ROWS.map((row) => (
          <div key={row.key} data-row={row.key}>
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
