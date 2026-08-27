import type { SeatingRowConfig } from "@/lib/seating-layout";
import type { SeatingCabin } from "@/lib/seating-cabins";

export type SideCabinsConfig = {
  hrManager: string;
  manager: string;
  /** Stable ids for occupancy (defaults: side-hr-manager / side-manager). */
  hrManagerId?: string;
  managerId?: string;
  /**
   * How many seating row blocks each side cabin spans.
   * Example (Pernambut): Conference = 2 (A–B), Sales Team = 1 (C).
   */
  spans?: {
    hrManager?: number;
    manager?: number;
  };
  /** Split the full side column (all seating rows) into two equal-height cabins. */
  equalHeights?: boolean;
};

export type ColanLayoutState = {
  rows: SeatingRowConfig[];
  cabinsBeforeA: SeatingCabin[];
  cabinsAfterG: SeatingCabin[];
  sideCabins: SideCabinsConfig;
};

export type RowPosition =
  | { type: "BEFORE"; target: string }
  | { type: "AFTER"; target: string }
  | { type: "BETWEEN"; after: string; before: string };

export type SeatPosition =
  | { between: [string, string] }
  | { after: string }
  | { before: string }
  | { leftOf: string }
  | { rightOf: string };

export type LayoutEditorOperation =
  | { action: "ADD_ROW"; newRow: string; position: RowPosition; pillars?: number; seatCount?: number }
  | { action: "INSERT_ROW_BETWEEN"; newRow: string; after: string; before: string; pillars?: number }
  | { action: "REMOVE_ROWS"; rows: string[] }
  | { action: "REPLACE_ROW"; source: string; target: string }
  | { action: "DUPLICATE_ROW"; source: string; newRow: string; position?: RowPosition }
  | { action: "REMOVE_SEATS"; seats: string[] }
  | { action: "REMOVE_SEATS_KEEP_SPACE"; seats: string[] }
  | { action: "REMOVE_SEATS_AND_COLLAPSE"; seats: string[] }
  | { action: "ADD_SEAT"; seatId?: string; position: SeatPosition }
  | { action: "ADD_PILLAR"; pillarId?: string; position: SeatPosition }
  | { action: "REPLACE_SEATS_WITH_PILLAR"; seats: string[]; pillarId?: string }
  | { action: "REMOVE_PILLAR_ADD_SEATS"; pillarId?: string; seatCount: number }
  | { action: "CREATE_EMPTY_SPACE"; location: string[] }
  | { action: "EMPTY_SPACE_TO_SEATS"; seatCount: number; row?: string }
  | { action: "ADD_CABIN"; label: string; placement: "before-A" | "after-G" | "side-left"; id?: string }
  | { action: "REMOVE_CABIN"; cabinId: string }
  | { action: "UPDATE_CABIN"; cabinId: string; label: string }
  | { action: "ADD_SEATS_TO_ROW"; row: string; count: number }
  | { action: "ADD_PILLARS_TO_ROW"; row: string; count: number }
  | { action: "REMOVE_PILLARS_FROM_ROW"; row: string; count?: number }
  | { action: "REMOVE_ALL_PILLARS"; rows?: string[] };

export type LayoutEditorResponse = {
  summary: string;
  operations: LayoutEditorOperation[];
  errors?: string[];
};

export type LayoutEditorApplyResult = {
  layout: ColanLayoutState;
  summary: string;
  warnings: string[];
  errors: string[];
  occupancySwaps: Array<[string, string]>;
};
