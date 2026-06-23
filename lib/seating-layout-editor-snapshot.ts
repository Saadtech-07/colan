import type { FloorCell, SeatingRowConfig } from "@/lib/seating-layout";
import type { SeatingCabin } from "@/lib/seating-cabins";
import type { ColanLayoutState, SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import {
  CABINS_AFTER_G_ROW,
  CABINS_BEFORE_A_ROW,
} from "@/lib/seating-cabins";

export const DEFAULT_SIDE_CABINS: SideCabinsConfig = {
  hrManager: "HR Manager",
  manager: "Manager",
};

export function defaultColanLayoutState(): ColanLayoutState {
  return {
    rows: [],
    cabinsBeforeA: [...CABINS_BEFORE_A_ROW],
    cabinsAfterG: [...CABINS_AFTER_G_ROW],
    sideCabins: { ...DEFAULT_SIDE_CABINS },
  };
}

function cellSnapshot(cell: FloorCell, index: number) {
  switch (cell.kind) {
    case "seat":
      return { type: "seat", seatId: cell.id, index };
    case "pillar":
      return { type: "pillar", pillarId: `P-${index}`, index };
    case "gap":
      return { type: "empty", emptyId: `E-${index}`, index };
    case "entrance":
      return { type: "entrance", text: cell.text, index };
    case "label":
      return { type: "label", text: cell.text, index };
    default:
      return { type: "unknown", index };
  }
}

export function buildLayoutSnapshot(layout: ColanLayoutState) {
  return {
    rows: layout.rows.map((row) => ({
      rowId: row.key,
      label: row.label,
      seatCount: row.seatCount,
      seatIds: [...row.top, ...row.bottom]
        .filter((cell): cell is Extract<FloorCell, { kind: "seat" }> => cell.kind === "seat")
        .map((cell) => cell.id),
      top: row.top.map((cell, index) => cellSnapshot(cell, index)),
      bottom: row.bottom.map((cell, index) => cellSnapshot(cell, index)),
    })),
    cabins: {
      beforeA: layout.cabinsBeforeA.map((cabin) => ({
        cabinId: cabin.id,
        label: cabin.label,
        placement: cabin.placement,
      })),
      afterG: layout.cabinsAfterG.map((cabin) => ({
        cabinId: cabin.id,
        label: cabin.label,
        placement: cabin.placement,
      })),
      sideLeft: [
        { cabinId: "side-hr-manager", label: layout.sideCabins.hrManager },
        { cabinId: "side-manager", label: layout.sideCabins.manager },
      ],
    },
  };
}

export function cloneCabins(cabins: SeatingCabin[]): SeatingCabin[] {
  return cabins.map((cabin) => ({ ...cabin }));
}

export function cloneLayoutState(layout: ColanLayoutState): ColanLayoutState {
  return {
    rows: layout.rows.map((row) => ({
      ...row,
      top: row.top.map((cell) => ({ ...cell }) as FloorCell),
      bottom: row.bottom.map((cell) => ({ ...cell }) as FloorCell),
    })),
    cabinsBeforeA: cloneCabins(layout.cabinsBeforeA),
    cabinsAfterG: cloneCabins(layout.cabinsAfterG),
    sideCabins: { ...layout.sideCabins },
  };
}
