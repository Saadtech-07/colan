"use client";

import { SeatingCabinBlock } from "@/components/seating/seating-3d";
import type { SeatingCabin } from "@/lib/seating-cabins";
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
  selectedCabinId?: string | null;
  canAssign?: boolean;
  onCabinClick?: (cabinId: string) => void;
};

export function SeatingCabinRow({
  cabins,
  className,
  seatSpan = 16,
  cabinOccupancy,
  selectedCabinId = null,
  canAssign = false,
  onCabinClick,
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
            const occupant = cabinOccupancy?.get(cabin.id) ?? null;
            return (
              <SeatingCabinBlock
                key={cabin.id}
                label={cabin.label}
                width={cabinWidth}
                occupantName={occupant?.name}
                selected={selectedCabinId === cabin.id}
                canAssign={canAssign}
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
