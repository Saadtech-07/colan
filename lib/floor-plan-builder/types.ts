export type FloorPlanElementType =
  | "floor"
  | "block"
  | "room"
  | "cabin"
  | "meeting_room"
  | "conference_room"
  | "common_area"
  | "seat"
  | "desk"
  | "workstation"
  | "meeting_table"
  | "reception"
  | "pillar"
  | "wall"
  | "door"
  | "entrance"
  | "stairs";

export type ElementCategory = "structure" | "workspace" | "infrastructure";

export type FloorPlanElement = {
  id: string;
  type: FloorPlanElementType;
  name: string;
  parentId: string | null;
  row: number;
  column: number;
  width: number;
  height: number;
  rotation?: 0 | 90 | 180 | 270;
  properties?: Record<string, unknown>;
  /** Logical seat IDs for assignment compatibility (type=seat). */
  seatId?: string;
  /** Merged seat group reference. */
  mergeGroupId?: string;
};

export type FloorPlanGrid = {
  rows: number;
  columns: number;
};

export type WorkspaceBlock = {
  id: string;
  name: string;
  grid: FloorPlanGrid;
  elements: FloorPlanElement[];
};

export type FloorPlanLayoutState = {
  id?: string;
  floorPlanSlug?: string;
  name: string;
  status: "draft" | "published";
  version: number;
  grid: FloorPlanGrid;
  elements: FloorPlanElement[];
  /** Independent layout blocks within one workspace (Block A, Block B, …). */
  blocks?: WorkspaceBlock[];
};

export type Footprint = {
  parentId: string | null;
  row: number;
  column: number;
  width: number;
  height: number;
};

export type WorldFootprint = Footprint & {
  elementId: string;
  worldRow: number;
  worldColumn: number;
};

export type PlacementResult =
  | { ok: true; footprint: Footprint }
  | { ok: false; reason: string };

export type BulkSeatOptions = {
  parentId: string | null;
  startRow: number;
  startColumn: number;
  matrixRows: number;
  matrixColumns: number;
  direction: "left-to-right" | "top-to-bottom";
  idPrefix?: string;
  namePrefix?: string;
};

export type BulkElementOptions = {
  parentId: string | null;
  startRow: number;
  startColumn: number;
  count: number;
};

/** Builder / floor-plan grid seat tile size (px per cell). */
export const BUILDER_CELL_PX = 140;
export const BUILDER_CELL_GAP = 16;
export const BUILDER_CELL_STRIDE = BUILDER_CELL_PX + BUILDER_CELL_GAP;

export const DEFAULT_FLOOR_GRID: FloorPlanGrid = { rows: 12, columns: 12 };
export const DEFAULT_ROOM_SIZE = { width: 5, height: 5 };
