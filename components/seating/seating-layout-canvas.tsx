"use client";

import * as React from "react";
import { SeatCard } from "@/components/seating/seat-card";
import type { SeatingAiZone } from "@/lib/seating-ai-types";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  zones: SeatingAiZone[];
  occupancy: Map<string, Employee>;
  zoneBySeat: Map<string, string>;
  selectedSeat: string | null;
  canAssign: boolean;
  zoom: number;
  onSeatClick: (seatId: string) => void;
  onAssignSeat: (seatId: string, employeeId: string) => void;
};

export function SeatingLayoutCanvas({
  zones,
  occupancy,
  zoneBySeat,
  selectedSeat,
  canAssign,
  zoom,
  onSeatClick,
  onAssignSeat,
}: Props) {
  const [dragEmployeeId, setDragEmployeeId] = React.useState<string | null>(null);

  return (
    <div
      className="w-max origin-top transition-transform duration-200 ease-out"
      style={{ transform: `scale(${zoom})` }}
    >
      <div className="mx-auto min-w-max rounded-[34px] border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
        <div className="space-y-8">
          {zones.map((zone) => (
            <section key={zone.id} className="w-max space-y-3" data-layout-zone={zone.id}>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-700">
                  {zone.label}
                </h3>
                <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 text-xs text-muted-foreground">
                  {zone.seatIds.length} desks
                </span>
              </div>
              <div
                className={cn(
                  "flex w-max flex-wrap gap-2.5 rounded-[28px] border border-dashed border-violet-400/35 bg-violet-500/[0.04] p-4",
                )}
              >
                {zone.seatIds.map((seatId) => {
                  const occupant = occupancy.get(seatId) ?? null;
                  return (
                    <SeatCard
                      key={seatId}
                      seatId={seatId}
                      occupant={occupant}
                      selected={selectedSeat === seatId}
                      highlighted={false}
                      dimmed={false}
                      inLayoutCanvas
                      layoutZoneLabel={occupant ? null : zoneBySeat.get(seatId) ?? zone.label}
                      canAssign={canAssign}
                      onSelect={() => onSeatClick(seatId)}
                      onDragStart={(employeeId) => setDragEmployeeId(employeeId)}
                      onDrop={() => {
                        if (dragEmployeeId) {
                          onAssignSeat(seatId, dragEmployeeId);
                          setDragEmployeeId(null);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
