"use client";

import type { FloorCell } from "@/lib/seating-layout";
import { SeatCard } from "@/components/seating/seat-card";
import { SeatingStructuralBlock } from "@/components/seating/seating-3d";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

const SEAT_WIDTH = 108;
const SEAT_HEIGHT = 140;
const CELL_GAP = 10;
const LABEL_WIDTH = 128;
const PILLAR_WIDTH = SEAT_WIDTH * 2 + CELL_GAP;
const ENTRANCE_WIDTH = SEAT_WIDTH * 3 + CELL_GAP * 2;
const ROW_LABEL_HEIGHT = SEAT_HEIGHT + 12;

function renderCell(
  cell: FloorCell,
  ctx: {
    occupancy: Map<string, Employee>;
    selectedSeat: string | null;
    highlightSeats: Set<string> | null;
    layoutSeats: Set<string> | null;
    zoneBySeat: Map<string, string>;
    layoutMode: boolean;
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
  if (ctx.layoutMode && cell.kind !== "seat") {
    return null;
  }

  switch (cell.kind) {
    case "label":
      return (
        <div
          key={key}
          className="flex shrink-0 items-center justify-end pr-4 text-right text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 drop-shadow-sm"
          style={{ width: LABEL_WIDTH, height: ROW_LABEL_HEIGHT }}
        >
          {cell.text}
        </div>
      );
    case "pillar":
      return (
        <SeatingStructuralBlock
          key={key}
          variant="pillar"
          width={PILLAR_WIDTH}
          height={SEAT_HEIGHT}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/90 drop-shadow-sm">
            Pillar
          </span>
        </SeatingStructuralBlock>
      );
    case "entrance":
      return (
        <SeatingStructuralBlock
          key={key}
          variant="entrance"
          width={ENTRANCE_WIDTH}
          height={SEAT_HEIGHT}
        >
          <span className="text-[10px] font-bold uppercase leading-tight tracking-[0.2em] text-sky-800">
            {cell.text}
          </span>
        </SeatingStructuralBlock>
      );
    case "gap":
      return (
        <div
          key={key}
          className="shrink-0"
          style={{ width: ENTRANCE_WIDTH, height: ROW_LABEL_HEIGHT }}
          aria-hidden
        />
      );
    case "seat": {
      const emp = ctx.occupancy.get(cell.id) ?? null;
      const highlighted = ctx.highlightSeats?.has(cell.id) ?? false;
      const inLayout = ctx.layoutSeats?.has(cell.id) ?? false;
      const dimmed =
        ctx.layoutMode && ctx.layoutSeats
          ? !inLayout || ctx.dimSeat(cell.id, emp)
          : ctx.dimSeat(cell.id, emp);
      const hidden =
        ctx.layoutMode && ctx.layoutSeats
          ? !inLayout
          : ctx.hideSeat(cell.id, emp);
      if (hidden) {
        return (
          <div
            key={key}
            className="shrink-0 opacity-0"
            style={{ width: SEAT_WIDTH, height: ROW_LABEL_HEIGHT }}
            aria-hidden
          />
        );
      }
      return (
        <SeatCard
          key={key}
          seatId={cell.id}
          occupant={emp}
          selected={ctx.selectedSeat === cell.id}
          highlighted={highlighted}
          dimmed={dimmed}
          inLayoutCanvas={ctx.layoutMode && inLayout}
          layoutZoneLabel={ctx.zoneBySeat.get(cell.id) ?? null}
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
  layoutSeats?: Set<string> | null;
  zoneBySeat?: Map<string, string>;
  layoutMode?: boolean;
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
  layoutSeats = null,
  zoneBySeat = new Map(),
  layoutMode = false,
  ...ctx
}: Props) {
  const cellCtx = { ...ctx, layoutSeats, zoneBySeat, layoutMode };
  return (
    <div className={cn("w-max", showAisle && "mb-6")}>
      <div className="flex w-max items-end gap-2.5 overflow-visible">
        {top.map((c, i) => renderCell(c, cellCtx, `t-${i}`))}
      </div>
      <div className="mt-2 flex w-max items-end gap-2.5 overflow-visible">
        {bottom.map((c, i) => renderCell(c, cellCtx, `b-${i}`))}
      </div>
    </div>
  );
}
