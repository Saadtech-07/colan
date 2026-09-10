"use client";

import { History } from "lucide-react";
import { SeatCardContent } from "@/components/seating/seat-card-content";
import { SeatingSeatBlock } from "@/components/seating/seating-3d";
import type { Employee } from "@/types";

type Props = {
  seatId: string;
  occupant: Employee | null;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  layoutZoneLabel?: string | null;
  inLayoutCanvas?: boolean;
  canAssign: boolean;
  onSelect: () => void;
  onViewHistory?: () => void;
  onDragStart?: (employeeId: string) => void;
  onDrop?: () => void;
};

export function SeatCard({
  seatId,
  occupant,
  selected,
  highlighted,
  dimmed,
  layoutZoneLabel,
  inLayoutCanvas = false,
  canAssign,
  onSelect,
  onViewHistory,
  onDragStart,
  onDrop,
}: Props) {
  const occupied = !!occupant;
  const emphasized = selected || highlighted;

  return (
    <SeatingSeatBlock occupied={occupied} emphasized={emphasized}>
      <SeatCardContent
        seatId={seatId}
        occupant={occupant}
        selected={selected}
        highlighted={highlighted}
        dimmed={dimmed}
        layoutZoneLabel={layoutZoneLabel}
        inLayoutCanvas={inLayoutCanvas}
        canAssign={canAssign}
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDrop={onDrop}
      />
      {onViewHistory ? (
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
