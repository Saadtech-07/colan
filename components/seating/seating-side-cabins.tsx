"use client";

import * as React from "react";
import { SeatingCabinBlock } from "@/components/seating/seating-3d";
import { isTeamCabinLabel, sideCabinSlots } from "@/lib/cabin-utils";
import {
  ROW_AISLE_MARGIN,
  ROW_BLOCK_HEIGHT,
  SIDE_CABIN_TOP_OFFSET,
  SIDE_CABIN_WIDTH,
} from "@/lib/seating-layout-metrics";
import { EMPTY_SIDE_CABINS } from "@/lib/seating-layout-editor-snapshot";
import type { SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  sideCabins?: SideCabinsConfig;
  /** Total seating row blocks beside the side column (Pernambut = 3). */
  rowCount?: number;
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

/** Height of N seating row blocks including the aisles between them. */
function stackHeight(rowBlocks: number): number {
  const rows = Math.max(1, rowBlocks);
  return ROW_BLOCK_HEIGHT * rows + ROW_AISLE_MARGIN * Math.max(0, rows - 1);
}

export function SeatingSideCabins({
  className,
  sideCabins = EMPTY_SIDE_CABINS,
  rowCount = 2,
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
  const slots = sideCabinSlots(sideCabins);
  const columnRows = Math.max(1, rowCount);

  if (slots.length === 0) return null;

  /**
   * Cabin 0 → A-ROW (A1–A17); cabin 1 → B-ROW (B1–B24).
   * Face height equals one seating row block so no empty gaps appear between cabins.
   * equalHeights (Pernambut): split the full side column evenly.
   */
  const heightFor = (index: number): number => {
    if (sideCabins.equalHeights && slots.length === 2) {
      return Math.floor((stackHeight(columnRows) - ROW_AISLE_MARGIN) / 2);
    }
    if (slots.length === 1) {
      return stackHeight(sideCabins.spans?.hrManager ?? columnRows);
    }
    const spanKey = index === 0 ? "hrManager" : "manager";
    // Default one row each (HR Manager = A, Project Manager = B).
    const span = Math.max(1, Number(sideCabins.spans?.[spanKey] ?? 1) || 1);
    return stackHeight(span);
  };

  return (
    <div
      className={cn("flex shrink-0 flex-col", className)}
      style={{ width: SIDE_CABIN_WIDTH }}
      aria-label="Side office cabins"
    >
      <div style={{ height: SIDE_CABIN_TOP_OFFSET }} aria-hidden />
      {slots.map((slot, index) => {
        const height = heightFor(index);
        return (
          <React.Fragment key={slot.id}>
            {index > 0 ? (
              <div style={{ height: ROW_AISLE_MARGIN }} aria-hidden />
            ) : null}
            <SeatingCabinBlock
              cabinId={slot.id}
              label={slot.label}
              width={SIDE_CABIN_WIDTH}
              height={height}
              vertical
              occupantName={
                (cabinOccupants?.get(slot.id) ?? []).map((e) => e.name)[0] ??
                cabinOccupancy?.get(slot.id)?.name
              }
              occupantNames={
                isTeamCabinLabel(slot.label)
                  ? (cabinOccupants?.get(slot.id) ?? []).map((e) => e.name)
                  : undefined
              }
              selected={selectedCabinId === slot.id}
              canAssign={canAssign}
              canDragSwap={canDragSwap}
              onCabinDragStart={onCabinDragStart}
              onCabinDragEnd={onCabinDragEnd}
              onCabinDrop={onCabinDrop}
              onSelect={onCabinClick ? () => onCabinClick(slot.id) : undefined}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
