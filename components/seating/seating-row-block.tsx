"use client";

import type { FloorCell } from "@/lib/seating-layout";
import { SeatCard } from "@/components/seating/seat-card";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

function renderCell(
  cell: FloorCell,
  ctx: {
    occupancy: Map<string, Employee>;
    selectedSeat: string | null;
    highlightSeats: Set<string> | null;
    dimSeat: (seatId: string, emp: Employee | null) => boolean;
    hideSeat: (seatId: string, emp: Employee | null) => boolean;
    canAssign: boolean;
    onSeatClick: (seatId: string) => void;
    onSeatDrop: (seatId: string) => void;
    dragEmployeeId: string | null;
    onDragStart: (employeeId: string) => void;
  },
  key: string,
) {
  switch (cell.kind) {
    case "label":
      return (
        <div
          key={key}
          className="flex w-[88px] shrink-0 items-center justify-end pr-2 text-right text-[11px] font-bold uppercase tracking-wide text-sky-200"
        >
          {cell.text}
        </div>
      );
    case "pillar":
      return (
        <div
          key={key}
          className="mx-1 flex h-[52px] w-10 shrink-0 items-center justify-center rounded-sm bg-zinc-500 shadow-inner"
          aria-hidden
        />
      );
    case "entrance":
      return (
        <div
          key={key}
          className="mx-1 flex h-[52px] min-w-[140px] flex-1 max-w-[220px] items-center justify-center rounded-sm border-2 border-sky-300/80 bg-sky-400/90 px-2 text-center text-[10px] font-bold uppercase leading-tight text-white shadow-md"
        >
          {cell.text}
        </div>
      );
    case "gap":
      return <div key={key} className="h-[52px] w-[140px] shrink-0" aria-hidden />;
    case "seat": {
      const emp = ctx.occupancy.get(cell.id) ?? null;
      const highlighted = ctx.highlightSeats?.has(cell.id) ?? false;
      const dimmed = ctx.dimSeat(cell.id, emp);
      const hidden = ctx.hideSeat(cell.id, emp);
      if (hidden) {
        return <div key={key} className="h-[52px] w-[52px] shrink-0 opacity-0" aria-hidden />;
      }
      return (
        <SeatCard
          key={key}
          seatId={cell.id}
          occupant={emp}
          selected={ctx.selectedSeat === cell.id}
          highlighted={highlighted}
          dimmed={dimmed}
          canAssign={ctx.canAssign}
          onSelect={() => ctx.onSeatClick(cell.id)}
          onDragStart={ctx.onDragStart}
          onDrop={() => ctx.onSeatDrop(cell.id)}
        />
      );
    }
    default:
      return null;
  }
}

type Props = {
  top: FloorCell[];
  bottom: FloorCell[];
  occupancy: Map<string, Employee>;
  selectedSeat: string | null;
  highlightSeats: Set<string> | null;
  dimSeat: (seatId: string, emp: Employee | null) => boolean;
  hideSeat: (seatId: string, emp: Employee | null) => boolean;
  canAssign: boolean;
  onSeatClick: (seatId: string) => void;
  onSeatDrop: (seatId: string) => void;
  dragEmployeeId: string | null;
  onDragStart: (employeeId: string) => void;
  showAisle?: boolean;
};

export function SeatingRowBlock({
  top,
  bottom,
  showAisle = true,
  ...ctx
}: Props) {
  return (
    <div className={cn("w-full", showAisle && "mb-5")}>
      <div className="flex flex-wrap items-center gap-0.5">{top.map((c, i) => renderCell(c, ctx, `t-${i}`))}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-0.5">
        {bottom.map((c, i) => renderCell(c, ctx, `b-${i}`))}
      </div>
    </div>
  );
}
