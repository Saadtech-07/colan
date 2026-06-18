"use client";

import { SeatingCabinBlock } from "@/components/seating/seating-3d";
import type { SeatingCabin } from "@/lib/seating-cabins";
import { cn } from "@/lib/utils";

const LABEL_WIDTH = 128;
const SEAT_WIDTH = 108;
const CELL_GAP = 10;
/** Width of the A/G row seat grid (16 seats + gaps). */
const ROW_GRID_WIDTH = 16 * SEAT_WIDTH + 15 * CELL_GAP;
const CABIN_GAP = CELL_GAP;
const CABIN_WIDTH = Math.floor((ROW_GRID_WIDTH - CABIN_GAP * 2) / 3);

type Props = {
  cabins: SeatingCabin[];
  className?: string;
};

export function SeatingCabinRow({ cabins, className }: Props) {
  return (
    <div className={cn("w-max", className)}>
      <div className="flex w-max items-end gap-2.5 overflow-visible">
        <div className="shrink-0" style={{ width: LABEL_WIDTH, minHeight: 88 }} aria-hidden />
        <div className="flex items-stretch gap-2.5" style={{ width: ROW_GRID_WIDTH }}>
          {cabins.map((cabin) => (
            <SeatingCabinBlock key={cabin.id} label={cabin.label} width={CABIN_WIDTH} />
          ))}
        </div>
      </div>
    </div>
  );
}
