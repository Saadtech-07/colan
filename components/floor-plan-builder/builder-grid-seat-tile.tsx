"use client";

import { History } from "lucide-react";
import { SeatCardContent } from "@/components/seating/seat-card-content";
import { SeatingSeatBlock } from "@/components/seating/seating-3d";
import { getSeatDisplayName } from "@/lib/floor-plan-builder/layout-engine";
import type { FloorPlanElement } from "@/lib/floor-plan-builder/types";
import type { Employee } from "@/types";

type Props = {
  element: FloorPlanElement;
  /** When omitted, uses seat display name from element. */
  seatId?: string;
  occupant?: Employee | null;
  selected?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  /** Builder canvas: visual only; seating view: full assignment interactions. */
  interactive?: boolean;
  canAssign?: boolean;
  onSelect?: () => void;
  onViewHistory?: () => void;
  onDragStart?: (employeeId: string) => void;
  onDrop?: () => void;
  onPointerDown?: (event: React.PointerEvent) => void;
};

export function BuilderGridSeatTile({
  element,
  seatId: seatIdProp,
  occupant = null,
  selected = false,
  highlighted = false,
  dimmed = false,
  interactive = true,
  canAssign = false,
  onSelect,
  onViewHistory,
  onDragStart,
  onDrop,
  onPointerDown,
}: Props) {
  const seatId = seatIdProp ?? element.seatId ?? element.name;
  const displayName = getSeatDisplayName(element);
  const occupied = !!occupant;
  const emphasized = selected || highlighted;
  const isMerged = element.width > 1 || element.height > 1 || Boolean(element.mergeGroupId);

  return (
    <SeatingSeatBlock occupied={occupied} emphasized={emphasized} fillContainer staticVisual={!interactive}>
      <SeatCardContent
        seatId={displayName}
        occupant={occupant}
        selected={selected}
        highlighted={highlighted}
        dimmed={dimmed}
        canAssign={interactive ? canAssign : false}
        asDiv={!interactive}
        floorPlanMode
        builderCanvas={!interactive}
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onPointerDown={onPointerDown}
      />
      {isMerged ? (
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-800 shadow-sm">
          Merged
        </span>
      ) : null}
      {interactive && onViewHistory ? (
        <button
          type="button"
          className="absolute right-1.5 top-1.5 z-40 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View history for seat ${seatId}`}
          title="View history"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onViewHistory();
          }}
        >
          <History className="h-3 w-3" />
        </button>
      ) : null}
    </SeatingSeatBlock>
  );
}
