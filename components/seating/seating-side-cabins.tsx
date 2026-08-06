"use client";

import * as React from "react";
import { SeatingCabinBlock } from "@/components/seating/seating-3d";
import { sideCabinSlots } from "@/lib/cabin-utils";
import {
  ROW_AISLE_MARGIN,
  ROW_BLOCK_HEIGHT,
  SIDE_CABIN_TOP_OFFSET,
  SIDE_CABIN_WIDTH,
} from "@/lib/seating-layout-metrics";
import { DEFAULT_SIDE_CABINS } from "@/lib/seating-layout-editor-snapshot";
import type { SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  sideCabins?: SideCabinsConfig;
  /** Total seating row blocks beside the side column (Pernambut = 3). */
  rowCount?: number;
  cabinOccupancy?: Map<string, Employee>;
  selectedCabinId?: string | null;
  canAssign?: boolean;
  onCabinClick?: (cabinId: string) => void;
};

function cabinHeight(rowBlocks: number): number {
  const rows = Math.max(1, rowBlocks);
  return ROW_BLOCK_HEIGHT * rows + ROW_AISLE_MARGIN * Math.max(0, rows - 1);
}

export function SeatingSideCabins({
  className,
  sideCabins = DEFAULT_SIDE_CABINS,
  rowCount = 2,
  cabinOccupancy,
  selectedCabinId = null,
  canAssign = false,
  onCabinClick,
}: Props) {
  const slots = sideCabinSlots(sideCabins);
  const columnRows = Math.max(1, rowCount);

  if (slots.length === 0) return null;

  const equal =
    sideCabins.equalHeights && slots.length === 2
      ? Math.floor((cabinHeight(columnRows) - ROW_AISLE_MARGIN) / 2)
      : null;

  const heightFor = (index: number) => {
    if (equal != null) return equal;
    if (slots.length === 1) {
      const span =
        index === 0
          ? (sideCabins.spans?.hrManager ?? columnRows)
          : (sideCabins.spans?.manager ?? columnRows);
      return cabinHeight(span);
    }
    const span =
      index === 0
        ? (sideCabins.spans?.hrManager ?? 1)
        : (sideCabins.spans?.manager ?? 1);
    return cabinHeight(span);
  };

  return (
    <div
      className={cn("flex shrink-0 flex-col", className)}
      style={{ width: SIDE_CABIN_WIDTH }}
      aria-label="Side office cabins"
    >
      <div style={{ height: SIDE_CABIN_TOP_OFFSET }} aria-hidden />
      {slots.map((slot, index) => (
        <React.Fragment key={slot.id}>
          {index > 0 ? (
            <div style={{ height: ROW_AISLE_MARGIN }} aria-hidden />
          ) : null}
          <SeatingCabinBlock
            label={slot.label}
            width={SIDE_CABIN_WIDTH}
            height={heightFor(index)}
            vertical
            occupantName={cabinOccupancy?.get(slot.id)?.name}
            selected={selectedCabinId === slot.id}
            canAssign={canAssign}
            onSelect={onCabinClick ? () => onCabinClick(slot.id) : undefined}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
