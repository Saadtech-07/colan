"use client";

import { SeatingCabinBlock } from "@/components/seating/seating-3d";
import {
  ROW_AISLE_MARGIN,
  ROW_BLOCK_HEIGHT,
  SIDE_CABIN_TOP_OFFSET,
  SIDE_CABIN_WIDTH,
} from "@/lib/seating-layout-metrics";
import { DEFAULT_SIDE_CABINS } from "@/lib/seating-layout-editor-snapshot";
import type { SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  sideCabins?: SideCabinsConfig;
};

export function SeatingSideCabins({ className, sideCabins = DEFAULT_SIDE_CABINS }: Props) {
  return (
    <div
      className={cn("flex shrink-0 flex-col", className)}
      style={{ width: SIDE_CABIN_WIDTH }}
      aria-label="Side office cabins"
    >
      <div style={{ height: SIDE_CABIN_TOP_OFFSET }} aria-hidden />
      {sideCabins.hrManager ? (
        <SeatingCabinBlock
          label={sideCabins.hrManager}
          width={SIDE_CABIN_WIDTH}
          height={ROW_BLOCK_HEIGHT}
          vertical
        />
      ) : null}
      <div style={{ height: ROW_AISLE_MARGIN }} aria-hidden />
      {sideCabins.manager ? (
        <SeatingCabinBlock
          label={sideCabins.manager}
          width={SIDE_CABIN_WIDTH}
          height={ROW_BLOCK_HEIGHT}
          vertical
        />
      ) : null}
    </div>
  );
}
