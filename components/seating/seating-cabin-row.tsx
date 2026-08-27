"use client";

import { SeatingCabinBlock } from "@/components/seating/seating-3d";
import type { SeatingCabin } from "@/lib/seating-cabins";
import { isTeamCabinLabel } from "@/lib/cabin-utils";
import {
  CELL_GAP,
  LABEL_WIDTH,
  SEAT_WIDTH,
} from "@/lib/seating-layout-metrics";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  cabins: SeatingCabin[];
  className?: string;
  /**
   * How many seat columns the cabin strip should span.
   * Chennai A-row = 16; Pernambut A1–A8 / C16–C9 = 8.
   */
  seatSpan?: number;
  cabinOccupancy?: Map<string, Employee>;
  cabinOccupants?: Map<string, Employee[]>;
  selectedCabinId?: string | null;
  canAssign?: boolean;
  onCabinClick?: (cabinId: string) => void;
  canDragSwap?: boolean;
  onCabinDragStart?: (cabinId: string) => void;
  onCabinDragEnd?: () => void;
  onCabinDrop?: (cabinId: string, sourceCabinId?: string) => void;
};

export function SeatingCabinRow({
  cabins,
  className,
  seatSpan = 16,
  cabinOccupancy,
  cabinOccupants,
  selectedCabinId = null,
  canAssign = false,
  onCabinClick,
  canDragSwap = false,
  onCabinDragStart,
  onCabinDragEnd,
  onCabinDrop,
}: Props) {
  if (cabins.length === 0) return null;

  const span = Math.max(1, seatSpan);
  const rowGridWidth = span * SEAT_WIDTH + Math.max(0, span - 1) * CELL_GAP;
  const cabinGap = CELL_GAP;
  const cabinWidth = Math.floor(
    (rowGridWidth - cabinGap * Math.max(0, cabins.length - 1)) / cabins.length,
  );

  return (
    <div className={cn("w-max", className)}>
      <div className="flex w-max items-end gap-2.5 overflow-visible">
        <div className="shrink-0" style={{ width: LABEL_WIDTH, minHeight: 88 }} aria-hidden />
        <div
          className="flex items-stretch"
          style={{ width: rowGridWidth, gap: cabinGap }}
        >
          {cabins.map((cabin) => {
            const team = isTeamCabinLabel(cabin.label);
            const occupants =
              cabinOccupants?.get(cabin.id) ??
              (cabinOccupancy?.get(cabin.id) ? [cabinOccupancy.get(cabin.id)!] : []);
            const names = occupants.map((e) => e.name);
            return (
              <SeatingCabinBlock
                key={cabin.id}
                cabinId={cabin.id}
                label={cabin.label}
                width={cabinWidth}
                occupantName={names[0] ?? null}
                occupantNames={team ? names : undefined}
                selected={selectedCabinId === cabin.id}
                canAssign={canAssign}
                canDragSwap={canDragSwap}
                onCabinDragStart={onCabinDragStart}
                onCabinDragEnd={onCabinDragEnd}
                onCabinDrop={onCabinDrop}
                onSelect={
                  onCabinClick ? () => onCabinClick(cabin.id) : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
