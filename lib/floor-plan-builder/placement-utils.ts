import { canPlaceInParent, getElementDefinition } from "./element-registry";
import { getDescendants, getParentElement, GridOccupancyMap } from "./hierarchy";
import type {
  FloorPlanElement,
  FloorPlanGrid,
  FloorPlanLayoutState,
  Footprint,
  PlacementResult,
} from "./types";

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function clampFootprintToParent(
  footprint: Footprint,
  parent: FloorPlanElement | null,
  grid: FloorPlanGrid,
): Footprint {
  const bounds = parent
    ? { rows: parent.height, columns: parent.width }
    : { rows: grid.rows, columns: grid.columns };

  const maxRow = Math.max(0, bounds.rows - footprint.height);
  const maxCol = Math.max(0, bounds.columns - footprint.width);

  return {
    ...footprint,
    row: Math.min(Math.max(0, Math.round(footprint.row)), maxRow),
    column: Math.min(Math.max(0, Math.round(footprint.column)), maxCol),
  };
}

export function validateFootprint(
  layout: FloorPlanLayoutState,
  footprint: Footprint,
  options?: {
    ignoreElementId?: string;
    elementType?: FloorPlanElement["type"];
  },
): PlacementResult {
  const parent = getParentElement(layout.elements, footprint.parentId);
  const parentType = parent?.type ?? null;
  const elementType = options?.elementType;

  if (elementType && parentType !== null) {
    if (!canPlaceInParent(elementType, parentType)) {
      return { ok: false, reason: `${elementType} cannot be placed in this parent.` };
    }
  }

  const occupancy = new GridOccupancyMap(layout.elements, layout.grid);
  const clamped = clampFootprintToParent(footprint, parent, layout.grid);

  if (
    clamped.row !== footprint.row ||
    clamped.column !== footprint.column ||
    clamped.width !== footprint.width ||
    clamped.height !== footprint.height
  ) {
    if (
      footprint.row < 0 ||
      footprint.column < 0 ||
      !occupancy.fitsInParent(footprint, parent, layout.grid)
    ) {
      return { ok: false, reason: "Element is outside the parent boundary." };
    }
  }

  if (!occupancy.fitsInParent(clamped, parent, layout.grid)) {
    return { ok: false, reason: "Element is outside the parent boundary." };
  }

  if (!occupancy.isFootprintFree(clamped, options?.ignoreElementId)) {
    return { ok: false, reason: "Cells are already occupied." };
  }

  return { ok: true, footprint: clamped };
}

/** Strict snap — never searches for alternate cells. */
export function snapFootprintStrict(
  layout: FloorPlanLayoutState,
  footprint: Footprint,
  options?: { ignoreElementId?: string; elementType?: FloorPlanElement["type"] },
): Footprint | null {
  const parent = getParentElement(layout.elements, footprint.parentId);
  const occupancy = new GridOccupancyMap(layout.elements, layout.grid);
  const snapped = occupancy.snapToGrid(
    footprint.parentId,
    footprint.row,
    footprint.column,
    footprint.width,
    footprint.height,
  );
  const clamped = clampFootprintToParent(snapped, parent, layout.grid);
  const result = validateFootprint(layout, clamped, options);
  return result.ok ? result.footprint : null;
}

export function childrenFitInContainer(
  elements: FloorPlanElement[],
  containerId: string,
  newWidth: number,
  newHeight: number,
): boolean {
  for (const child of getDescendants(elements, containerId)) {
    if (child.row + child.height > newHeight || child.column + child.width > newWidth) {
      return false;
    }
  }
  return true;
}

export function computeResizePatch(
  element: FloorPlanElement,
  edge: ResizeEdge,
  deltaRow: number,
  deltaCol: number,
): Partial<FloorPlanElement> | null {
  const def = getElementDefinition(element.type);
  let { row, column, width, height } = element;

  if (edge.includes("e")) {
    width = Math.max(def.minWidth, width + deltaCol);
  }
  if (edge.includes("w")) {
    const nextWidth = Math.max(def.minWidth, width - deltaCol);
    const widthDelta = width - nextWidth;
    if (widthDelta !== 0) {
      column += widthDelta;
      width = nextWidth;
    }
  }
  if (edge.includes("s")) {
    height = Math.max(def.minHeight, height + deltaRow);
  }
  if (edge.includes("n")) {
    const nextHeight = Math.max(def.minHeight, height - deltaRow);
    const heightDelta = height - nextHeight;
    if (heightDelta !== 0) {
      row += heightDelta;
      height = nextHeight;
    }
  }

  if (row < 0 || column < 0) return null;
  if (width < def.minWidth || height < def.minHeight) return null;

  return { row, column, width, height };
}

export function getContainerCapacity(element: FloorPlanElement): number | null {
  const cap = element.properties?.capacity;
  if (typeof cap === "number" && cap > 0) return cap;
  const def = getElementDefinition(element.type);
  if (!def.supportsCapacity) return null;
  return def.defaultCapacity ?? null;
}

export function seatCountInContainer(
  elements: FloorPlanElement[],
  containerId: string,
): number {
  return elements.filter(
    (el) => el.type === "seat" && el.parentId === containerId,
  ).length;
}

export function validateContainerCapacity(
  layout: FloorPlanLayoutState,
  parentId: string | null,
  addingSeats = 1,
  ignoreSeatIds?: string[],
): PlacementResult {
  if (!parentId) return { ok: true, footprint: { parentId: null, row: 0, column: 0, width: 1, height: 1 } };
  const parent = getParentElement(layout.elements, parentId);
  if (!parent) return { ok: true, footprint: { parentId: null, row: 0, column: 0, width: 1, height: 1 } };

  const capacity = getContainerCapacity(parent);
  if (capacity === null) return { ok: true, footprint: { parentId: null, row: 0, column: 0, width: 1, height: 1 } };

  const current = seatCountInContainer(
    layout.elements.filter((el) => !ignoreSeatIds?.includes(el.id)),
    parentId,
  );
  if (current + addingSeats > capacity) {
    return {
      ok: false,
      reason: `Room capacity reached. Maximum capacity is ${capacity}.`,
    };
  }
  return { ok: true, footprint: { parentId: null, row: 0, column: 0, width: 1, height: 1 } };
}
