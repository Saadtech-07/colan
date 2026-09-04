import { canPlaceInParent, getElementDefinition } from "./element-registry";
import { getWorldFootprint } from "./hierarchy";
import { elementPixelSize } from "./metrics";
import type { FloorPlanElement, FloorPlanGrid } from "./types";
import { BUILDER_CELL_STRIDE } from "./types";
import type { ResizeEdge } from "./placement-utils";

/** Visual dot spacing on the canvas — alignment aid only, not placement slots. */
export const CANVAS_DOT_SPACING = 20;

/** Default free-form seat footprint (logical px). */
export const DEFAULT_SEAT_WIDTH = 100;
export const DEFAULT_SEAT_HEIGHT = 96;

export const MIN_SEAT_WIDTH = 48;
export const MIN_SEAT_HEIGHT = 40;

/** Floor workspace bounds scale (px per grid row/column unit). */
export const CANVAS_BOUNDS_PX = 120;

export type FreeformRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function isFreeformSeat(element: FloorPlanElement): boolean {
  return element.type === "seat" && element.properties?.freeform === true;
}

export function getElementLocalPixelRect(
  elements: FloorPlanElement[],
  element: FloorPlanElement,
): FreeformRect {
  if (isFreeformSeat(element)) {
    return getFreeformRect(element);
  }
  const size = elementPixelSize(element.width, element.height);
  return {
    x: element.column * BUILDER_CELL_STRIDE,
    y: element.row * BUILDER_CELL_STRIDE,
    width: size.width,
    height: size.height,
  };
}

export function inferRowStartX(
  elements: FloorPlanElement[],
  parentId: string | null,
  sourceY: number,
  sourceX: number,
  tolerance = 2,
): number {
  let minX = sourceX;
  for (const el of elements) {
    if (el.parentId !== parentId) continue;
    const rect = getElementLocalPixelRect(elements, el);
    if (Math.abs(rect.y - sourceY) <= tolerance) {
      minX = Math.min(minX, rect.x);
    }
  }
  return minX;
}

export function getFreeformRect(element: FloorPlanElement): FreeformRect {
  const props = element.properties ?? {};
  if (props.freeform === true) {
    return {
      x: Number(props.x ?? 0),
      y: Number(props.y ?? 0),
      width: Number(props.canvasWidth ?? DEFAULT_SEAT_WIDTH),
      height: Number(props.canvasHeight ?? DEFAULT_SEAT_HEIGHT),
    };
  }

  const size = elementPixelSize(element.width, element.height);
  return {
    x: element.column * BUILDER_CELL_STRIDE,
    y: element.row * BUILDER_CELL_STRIDE,
    width: size.width,
    height: size.height,
  };
}

export function withFreeformRect(
  element: FloorPlanElement,
  rect: Partial<FreeformRect>,
): FloorPlanElement {
  const current = getFreeformRect(element);
  const next: FreeformRect = {
    x: rect.x ?? current.x,
    y: rect.y ?? current.y,
    width: rect.width ?? current.width,
    height: rect.height ?? current.height,
  };

  return {
    ...element,
    row: 0,
    column: 0,
    width: 1,
    height: 1,
    properties: {
      ...element.properties,
      freeform: true,
      x: Math.round(next.x),
      y: Math.round(next.y),
      canvasWidth: Math.round(next.width),
      canvasHeight: Math.round(next.height),
    },
  };
}

/** Convert a legacy grid-based seat into free-form geometry (local to parent). */
export function migrateSeatToFreeform(element: FloorPlanElement): FloorPlanElement {
  if (element.type !== "seat" || isFreeformSeat(element)) return element;
  const size = elementPixelSize(element.width, element.height);
  return withFreeformRect(element, {
    x: element.column * BUILDER_CELL_STRIDE,
    y: element.row * BUILDER_CELL_STRIDE,
    width: size.width,
    height: size.height,
  });
}

export function getGridElementWorldPixelRect(
  elements: FloorPlanElement[],
  element: FloorPlanElement,
): FreeformRect {
  const world = getWorldFootprint(elements, element);
  const size = elementPixelSize(element.width, element.height);
  return {
    x: world.worldColumn * BUILDER_CELL_STRIDE,
    y: world.worldRow * BUILDER_CELL_STRIDE,
    width: size.width,
    height: size.height,
  };
}

export function getWorldPixelRect(
  elements: FloorPlanElement[],
  element: FloorPlanElement,
): FreeformRect {
  if (isFreeformSeat(element)) {
    const local = getFreeformRect(element);
    let x = local.x;
    let y = local.y;
    let parentId = element.parentId;

    while (parentId) {
      const parent = elements.find((el) => el.id === parentId);
      if (!parent) break;
      if (isFreeformSeat(parent)) {
        const parentLocal = getFreeformRect(parent);
        x += parentLocal.x;
        y += parentLocal.y;
      } else {
        const parentWorld = getWorldFootprint(elements, parent);
        x += parentWorld.worldColumn * BUILDER_CELL_STRIDE;
        y += parentWorld.worldRow * BUILDER_CELL_STRIDE;
      }
      parentId = parent.parentId;
    }

    return { x, y, width: local.width, height: local.height };
  }

  return getGridElementWorldPixelRect(elements, element);
}

/** Convert container-local pixel coordinates to block-sheet coordinates. */
export function localPointToBlockPixel(
  elements: FloorPlanElement[],
  parentId: string | null,
  localX: number,
  localY: number,
): { x: number; y: number } {
  if (!parentId) return { x: localX, y: localY };
  const parent = elements.find((el) => el.id === parentId);
  if (!parent) return { x: localX, y: localY };
  const parentWorld = getWorldPixelRect(elements, parent);
  return { x: parentWorld.x + localX, y: parentWorld.y + localY };
}

export function getContainerPixelBounds(
  elements: FloorPlanElement[],
  parentId: string | null,
  grid: FloorPlanGrid,
): FreeformRect {
  if (!parentId) {
    return {
      x: 0,
      y: 0,
      width: grid.columns * CANVAS_BOUNDS_PX,
      height: grid.rows * CANVAS_BOUNDS_PX,
    };
  }
  const parent = elements.find((el) => el.id === parentId);
  if (!parent) {
    return {
      x: 0,
      y: 0,
      width: grid.columns * CANVAS_BOUNDS_PX,
      height: grid.rows * CANVAS_BOUNDS_PX,
    };
  }
  const size = elementPixelSize(parent.width, parent.height);
  return { x: 0, y: 0, width: size.width, height: size.height };
}

export function findContainerAtPixel(
  elements: FloorPlanElement[],
  worldX: number,
  worldY: number,
  childType: FloorPlanElement["type"],
): { container: FloorPlanElement; localX: number; localY: number } | null {
  const candidates = elements.filter((el) => {
    const def = getElementDefinition(el.type);
    if (!def.supportsChildren || !canPlaceInParent(childType, el.type)) return false;
    const rect = getWorldPixelRect(elements, el);
    return (
      worldX >= rect.x &&
      worldX < rect.x + rect.width &&
      worldY >= rect.y &&
      worldY < rect.y + rect.height
    );
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.width * a.height - b.width * b.height);
  const container = candidates[0]!;
  const rect = getWorldPixelRect(elements, container);
  return {
    container,
    localX: worldX - rect.x,
    localY: worldY - rect.y,
  };
}

export function isRectFullyInsideBounds(rect: FreeformRect, bounds: FreeformRect): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= bounds.width &&
    rect.y + rect.height <= bounds.height
  );
}

export function clampRectToBounds(rect: FreeformRect, bounds: FreeformRect): FreeformRect {
  const width = Math.max(MIN_SEAT_WIDTH, Math.min(rect.width, bounds.width));
  const height = Math.max(MIN_SEAT_HEIGHT, Math.min(rect.height, bounds.height));
  const maxX = Math.max(0, bounds.width - width);
  const maxY = Math.max(0, bounds.height - height);
  return {
    x: Math.min(Math.max(0, rect.x), maxX),
    y: Math.min(Math.max(0, rect.y), maxY),
    width,
    height,
  };
}

export function computeFreeformResizePatch(
  rect: FreeformRect,
  edge: ResizeEdge,
  deltaX: number,
  deltaY: number,
): FreeformRect | null {
  let { x, y, width, height } = rect;

  if (edge.includes("e")) {
    width = Math.max(MIN_SEAT_WIDTH, width + deltaX);
  }
  if (edge.includes("w")) {
    const nextWidth = Math.max(MIN_SEAT_WIDTH, width - deltaX);
    const dw = width - nextWidth;
    if (dw !== 0) {
      x += dw;
      width = nextWidth;
    }
  }
  if (edge.includes("s")) {
    height = Math.max(MIN_SEAT_HEIGHT, height + deltaY);
  }
  if (edge.includes("n")) {
    const nextHeight = Math.max(MIN_SEAT_HEIGHT, height - deltaY);
    const dh = height - nextHeight;
    if (dh !== 0) {
      y += dh;
      height = nextHeight;
    }
  }

  if (x < 0 || y < 0) return null;
  return { x, y, width, height };
}

export function getCanvasPixelSize(grid: FloorPlanGrid): { width: number; height: number } {
  return {
    width: grid.columns * CANVAS_BOUNDS_PX,
    height: grid.rows * CANVAS_BOUNDS_PX,
  };
}

export function createFreeformSeatProperties(
  x: number,
  y: number,
  width = DEFAULT_SEAT_WIDTH,
  height = DEFAULT_SEAT_HEIGHT,
): Record<string, unknown> {
  return {
    freeform: true,
    x: Math.round(x),
    y: Math.round(y),
    canvasWidth: Math.round(width),
    canvasHeight: Math.round(height),
  };
}

/** Horizontal gap between bulk-placed seats (canvas px). */
export const SEAT_BULK_GAP = 8;

/** Vertical gap between wrapped bulk seat rows (canvas px). */
export const SEAT_BULK_ROW_GAP = 8;

export type BulkFreeformSeatPosition = { x: number; y: number };

export function computeBulkFreeformSeatPositions(
  startX: number,
  startY: number,
  count: number,
  bounds: FreeformRect,
  seatWidth = DEFAULT_SEAT_WIDTH,
  seatHeight = DEFAULT_SEAT_HEIGHT,
  gap = SEAT_BULK_GAP,
  rowGap = SEAT_BULK_ROW_GAP,
): { positions: BulkFreeformSeatPosition[]; valid: boolean } {
  if (count <= 0) {
    return { positions: [], valid: false };
  }

  const stepX = seatWidth + gap;
  const stepY = seatHeight + rowGap;
  const availableWidth = bounds.width - startX;
  const availableHeight = bounds.height - startY;

  if (availableWidth < seatWidth || availableHeight < seatHeight) {
    return { positions: [], valid: false };
  }

  const itemsPerRow = Math.max(1, Math.floor((availableWidth + gap) / stepX));
  const positions: BulkFreeformSeatPosition[] = [];
  let x = startX;
  let y = startY;
  let col = 0;

  for (let index = 0; index < count; index += 1) {
    if (x + seatWidth > bounds.width || y + seatHeight > bounds.height) {
      return { positions, valid: false };
    }

    positions.push({ x, y });
    col += 1;

    if (col >= itemsPerRow) {
      col = 0;
      x = startX;
      y += stepY;
    } else {
      x += stepX;
    }
  }

  return { positions, valid: positions.length === count };
}
