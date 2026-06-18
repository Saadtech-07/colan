"use client";

import { SeatingCabinBlock } from "@/components/seating/seating-3d";
import {
  ROW_AISLE_MARGIN,
  ROW_BLOCK_HEIGHT,
  SIDE_CABIN_TOP_OFFSET,
  SIDE_CABIN_WIDTH,
} from "@/lib/seating-layout-metrics";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function SeatingSideCabins({ className }: Props) {
  return (
    <div
      className={cn("flex shrink-0 flex-col", className)}
      style={{ width: SIDE_CABIN_WIDTH }}
      aria-label="Side office cabins"
    >
      <div style={{ height: SIDE_CABIN_TOP_OFFSET }} aria-hidden />
      <SeatingCabinBlock
        label="HR Manager"
        width={SIDE_CABIN_WIDTH}
        height={ROW_BLOCK_HEIGHT}
        vertical
      />
      <div style={{ height: ROW_AISLE_MARGIN }} aria-hidden />
      <SeatingCabinBlock
        label="Manager"
        width={SIDE_CABIN_WIDTH}
        height={ROW_BLOCK_HEIGHT}
        vertical
      />
    </div>
  );
}
