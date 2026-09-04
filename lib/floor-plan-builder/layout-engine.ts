import { canPlaceInParent, getElementDefinition } from "./element-registry";
import {
  findContainerAtWorldCell,
  getDescendants,
  getParentElement,
  getWorldFootprint,
  GridOccupancyMap,
} from "./hierarchy";
import type {
  BulkSeatOptions,
  BulkElementOptions,
  FloorPlanElement,
  FloorPlanElementType,
  FloorPlanGrid,
  FloorPlanLayoutState,
  Footprint,
  PlacementResult,
} from "./types";
import {
  childrenFitInContainer,
  computeResizePatch,
  snapFootprintStrict,
  validateContainerCapacity,
  validateFootprint,
  type ResizeEdge,
} from "./placement-utils";
import { DEFAULT_FLOOR_GRID, DEFAULT_ROOM_SIZE, BUILDER_CELL_STRIDE } from "./types";
import {
  clampRectToBounds,
  computeFreeformResizePatch,
  CANVAS_BOUNDS_PX,
  computeBulkFreeformSeatPositions,
  createFreeformSeatProperties,
  DEFAULT_SEAT_HEIGHT,
  DEFAULT_SEAT_WIDTH,
  getContainerPixelBounds,
  getElementLocalPixelRect,
  getFreeformRect,
  inferRowStartX,
  isFreeformSeat,
  isRectFullyInsideBounds,
  migrateSeatToFreeform,
  SEAT_BULK_GAP,
  SEAT_BULK_ROW_GAP,
  withFreeformRect,
  type FreeformRect,
} from "./freeform-geometry";

export type BulkFreeformSeatOptions = {
  parentId: string | null;
  startX: number;
  startY: number;
  count: number;
};

export type { ResizeEdge } from "./placement-utils";
export {
  childrenFitInContainer,
  computeResizePatch,
  getContainerCapacity,
  seatCountInContainer,
  snapFootprintStrict,
  validateContainerCapacity,
  validateFootprint,
} from "./placement-utils";

export function createElementId(prefix = "el"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSeatId(elements: FloorPlanElement[], prefix = "S"): string {
  const used = new Set(
    elements
      .filter((el) => el.type === "seat" && el.seatId)
      .map((el) => el.seatId!.toUpperCase()),
  );
  let index = 1;
  while (used.has(`${prefix}${index}`.toUpperCase())) {
    index += 1;
  }
  return `${prefix}${index}`;
}

export function createRoomName(elements: FloorPlanElement[]): string {
  const used = new Set(
    elements.filter((el) => el.type === "room").map((el) => el.name.trim().toLowerCase()),
  );
  if (!used.has("room")) return "Room";
  let index = 2;
  while (used.has(`room ${index}`)) index += 1;
  return `Room ${index}`;
}

export function createEmptyLayout(name = "New Floor"): FloorPlanLayoutState {
  return {
    name,
    status: "draft",
    version: 0,
    grid: { ...DEFAULT_FLOOR_GRID },
    elements: [],
  };
}

export function createElement(
  type: FloorPlanElementType,
  options: {
    name?: string;
    parentId?: string | null;
    row?: number;
    column?: number;
    width?: number;
    height?: number;
    rotation?: 0 | 90 | 180 | 270;
    seatId?: string;
    properties?: Record<string, unknown>;
  } = {},
): FloorPlanElement {
  const def = getElementDefinition(type);
  return {
    id: createElementId(type.slice(0, 3)),
    type,
    name:
      options.name ??
      (type === "seat" && options.seatId ? options.seatId : def.label),
    parentId: options.parentId ?? null,
    row: options.row ?? 0,
    column: options.column ?? 0,
    width: options.width ?? def.defaultWidth,
    height: options.height ?? def.defaultHeight,
    rotation: options.rotation ?? 0,
    seatId: type === "seat" ? options.seatId : undefined,
    properties:
      type === "seat"
        ? (options.properties?.freeform
            ? options.properties
            : createFreeformSeatProperties(
                Number(options.properties?.x ?? 0),
                Number(options.properties?.y ?? 0),
                options.properties?.canvasWidth != null
                  ? Number(options.properties.canvasWidth)
                  : DEFAULT_SEAT_WIDTH,
                options.properties?.canvasHeight != null
                  ? Number(options.properties.canvasHeight)
                  : DEFAULT_SEAT_HEIGHT,
              ))
        : def.supportsCapacity && def.defaultCapacity
          ? { capacity: def.defaultCapacity, ...options.properties }
          : options.properties,
  };
}

export function ensureFreeformSeats(elements: FloorPlanElement[]): FloorPlanElement[] {
  return elements.map((el) => (el.type === "seat" ? migrateSeatToFreeform(el) : el));
}

export function validatePlacement(
  layout: FloorPlanLayoutState,
  element: FloorPlanElement,
  ignoreElementId?: string,
): PlacementResult {
  const parent = getParentElement(layout.elements, element.parentId);
  const parentType = parent?.type ?? null;

  if (!canPlaceInParent(element.type, parentType)) {
    return { ok: false, reason: `${element.type} cannot be placed in this parent.` };
  }

  if (element.type === "seat" && element.parentId) {
    const cap = validateContainerCapacity(layout, element.parentId, 1, ignoreElementId ? [ignoreElementId] : undefined);
    if (!cap.ok) return cap;
  }

  if (isFreeformSeat(element)) {
    const bounds = getContainerPixelBounds(layout.elements, element.parentId, layout.grid);
    const rect = getFreeformRect(element);
    if (!isRectFullyInsideBounds(rect, bounds)) {
      return {
        ok: false,
        reason: element.parentId
          ? "Seat must remain fully inside the container."
          : "Seat is outside the workspace boundary.",
      };
    }
    return { ok: true, footprint: { parentId: element.parentId, row: 0, column: 0, width: 1, height: 1 } };
  }

  return validateFootprint(
    layout,
    {
      parentId: element.parentId,
      row: element.row,
      column: element.column,
      width: element.width,
      height: element.height,
    },
    { ignoreElementId: ignoreElementId ?? element.id, elementType: element.type },
  );
}

export function addElement(
  layout: FloorPlanLayoutState,
  element: FloorPlanElement,
): { layout: FloorPlanLayoutState; error?: string } {
  const validation = validatePlacement(layout, element);
  if (!validation.ok) {
    return { layout, error: validation.reason };
  }
  return {
    layout: {
      ...layout,
      elements: [...layout.elements, element],
    },
  };
}

export function snapRotationDegrees(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((angle % 360) + 360) % 360;
  const snapped = Math.round(normalized / 90) * 90;
  return (snapped === 360 ? 0 : snapped) as 0 | 90 | 180 | 270;
}

export function moveFreeformElement(
  layout: FloorPlanLayoutState,
  elementId: string,
  x: number,
  y: number,
): { layout: FloorPlanLayoutState; error?: string } {
  const current = layout.elements.find((el) => el.id === elementId);
  if (!current || !isFreeformSeat(current)) {
    return { layout, error: "Element not found." };
  }

  const bounds = getContainerPixelBounds(layout.elements, current.parentId, layout.grid);
  const rect = clampRectToBounds({ ...getFreeformRect(current), x, y }, bounds);
  const next = withFreeformRect(current, rect);
  const without = layout.elements.filter((el) => el.id !== elementId);
  const validation = validatePlacement({ ...layout, elements: without }, next, elementId);
  if (!validation.ok) {
    return { layout, error: validation.reason };
  }

  return {
    layout: {
      ...layout,
      elements: layout.elements.map((el) => (el.id === elementId ? next : el)),
    },
  };
}

export function resizeFreeformElement(
  layout: FloorPlanLayoutState,
  elementId: string,
  edge: ResizeEdge,
  deltaX: number,
  deltaY: number,
): { layout: FloorPlanLayoutState; error?: string; preview?: FreeformRect } {
  const current = layout.elements.find((el) => el.id === elementId);
  if (!current || !isFreeformSeat(current)) {
    return { layout, error: "Element not found." };
  }

  const currentRect = getFreeformRect(current);
  const patch = computeFreeformResizePatch(currentRect, edge, deltaX, deltaY);
  if (!patch) return { layout, error: "Invalid resize." };

  const bounds = getContainerPixelBounds(layout.elements, current.parentId, layout.grid);
  if (!isRectFullyInsideBounds(patch, bounds)) {
    return { layout, error: "Seat must remain fully inside the container." };
  }

  const next = withFreeformRect(current, patch);
  const without = layout.elements.filter((el) => el.id !== elementId);
  const validation = validatePlacement({ ...layout, elements: without }, next, elementId);
  if (!validation.ok) {
    return { layout, error: validation.reason };
  }

  return {
    layout: {
      ...layout,
      elements: layout.elements.map((el) => (el.id === elementId ? next : el)),
    },
    preview: patch,
  };
}

export function resizeElement(
  layout: FloorPlanLayoutState,
  elementId: string,
  edge: ResizeEdge,
  deltaRow: number,
  deltaCol: number,
): { layout: FloorPlanLayoutState; error?: string; preview?: Partial<FloorPlanElement> } {
  const current = layout.elements.find((el) => el.id === elementId);
  if (!current) return { layout, error: "Element not found." };

  if (isFreeformSeat(current)) {
    return { layout, error: "Use freeform resize for seats." };
  }

  const patch = computeResizePatch(current, edge, deltaRow, deltaCol);
  if (!patch) return { layout, error: "Invalid resize." };

  const def = getElementDefinition(current.type);
  if (def.supportsChildren && (patch.width !== undefined || patch.height !== undefined)) {
    const nextW = patch.width ?? current.width;
    const nextH = patch.height ?? current.height;
    if (!childrenFitInContainer(layout.elements, elementId, nextW, nextH)) {
      return { layout, error: "Cannot shrink: children would be outside the container." };
    }
  }

  const next: FloorPlanElement = { ...current, ...patch };
  const without = layout.elements.filter((el) => el.id !== elementId);
  const validation = validatePlacement({ ...layout, elements: without }, next, elementId);
  if (!validation.ok) {
    return { layout, error: validation.reason };
  }

  return {
    layout: {
      ...layout,
      elements: layout.elements.map((el) => (el.id === elementId ? next : el)),
    },
    preview: patch,
  };
}

export function updateElement(
  layout: FloorPlanLayoutState,
  elementId: string,
  patch: Partial<FloorPlanElement>,
): { layout: FloorPlanLayoutState; error?: string } {
  const current = layout.elements.find((el) => el.id === elementId);
  if (!current) return { layout, error: "Element not found." };

  let next: FloorPlanElement = { ...current, ...patch, id: current.id, type: current.type };

  if (isFreeformSeat(current)) {
    const props = patch.properties ?? {};
    const rectPatch: Partial<FreeformRect> = {};
    if (props.x !== undefined) rectPatch.x = Number(props.x);
    if (props.y !== undefined) rectPatch.y = Number(props.y);
    if (props.canvasWidth !== undefined) rectPatch.width = Number(props.canvasWidth);
    if (props.canvasHeight !== undefined) rectPatch.height = Number(props.canvasHeight);
    if (Object.keys(rectPatch).length > 0) {
      next = withFreeformRect(next, rectPatch);
    }
  }

  if (patch.rotation !== undefined && patch.rotation !== (current.rotation ?? 0) && !isFreeformSeat(current)) {
    const oldVertical = (current.rotation ?? 0) === 90 || (current.rotation ?? 0) === 270;
    const newVertical = patch.rotation === 90 || patch.rotation === 270;
    if (oldVertical !== newVertical) {
      next.width = current.height;
      next.height = current.width;
    }
  }

  const without = layout.elements.filter((el) => el.id !== elementId);
  const validation = validatePlacement({ ...layout, elements: without }, next, elementId);
  if (!validation.ok) {
    return { layout, error: validation.reason };
  }

  let elements = layout.elements.map((el) => (el.id === elementId ? next : el));
  return { layout: { ...layout, elements } };
}

export function deleteElement(
  layout: FloorPlanLayoutState,
  elementId: string,
  deleteChildren = true,
): FloorPlanLayoutState {
  const toDelete = new Set<string>([elementId]);
  if (deleteChildren) {
    for (const child of getDescendants(layout.elements, elementId)) {
      toDelete.add(child.id);
    }
  }
  return {
    ...layout,
    elements: layout.elements.filter((el) => !toDelete.has(el.id)),
  };
}

function inferRowStartColumn(
  elements: FloorPlanElement[],
  parentId: string | null,
  row: number,
): number {
  let minColumn = Infinity;
  let found = false;
  for (const el of elements) {
    if (el.parentId !== parentId || isFreeformSeat(el)) continue;
    if (el.row !== row) continue;
    found = true;
    minColumn = Math.min(minColumn, el.column);
  }
  return found ? minColumn : 0;
}

function getContainerGridBounds(
  layout: FloorPlanLayoutState,
  parentId: string | null,
): { rows: number; columns: number } {
  const parent = getParentElement(layout.elements, parentId);
  return parent ? { rows: parent.height, columns: parent.width } : layout.grid;
}

export function computeDuplicateAdjacentPosition(
  layout: FloorPlanLayoutState,
  element: FloorPlanElement,
): { ok: true; row: number; column: number; x?: number; y?: number } | { ok: false; error: string } {
  if (isFreeformSeat(element)) {
    const rect = getFreeformRect(element);
    const bounds = getContainerPixelBounds(layout.elements, element.parentId, layout.grid);
    let newX = rect.x + rect.width + SEAT_BULK_GAP;
    let newY = rect.y;

    if (newX + rect.width > bounds.width) {
      newY = rect.y + rect.height + SEAT_BULK_ROW_GAP;
      newX = inferRowStartX(layout.elements, element.parentId, rect.y, rect.x);
    }

    if (
      newY + rect.height > bounds.height ||
      newX + rect.width > bounds.width ||
      newX < 0 ||
      newY < 0
    ) {
      return { ok: false, error: "Not enough space to duplicate element." };
    }

    return { ok: true, row: element.row, column: element.column, x: newX, y: newY };
  }

  const gridBounds = getContainerGridBounds(layout, element.parentId);
  let newColumn = element.column + element.width;
  let newRow = element.row;

  if (newColumn + element.width > gridBounds.columns) {
    newRow = element.row + element.height;
    newColumn = inferRowStartColumn(layout.elements, element.parentId, element.row);
    if (newRow + element.height > gridBounds.rows) {
      return { ok: false, error: "Not enough space to duplicate element." };
    }
  }

  return { ok: true, row: newRow, column: newColumn };
}

export function duplicateSubtree(
  layout: FloorPlanLayoutState,
  rootId: string,
  offsetRow?: number,
  offsetColumn?: number,
): { layout: FloorPlanLayoutState; error?: string; newRootId?: string } {
  const root = layout.elements.find((el) => el.id === rootId);
  if (!root) return { layout, error: "Element not found." };

  const useGridOffset = offsetRow != null && offsetColumn != null;
  const adjacentPosition = useGridOffset ? null : computeDuplicateAdjacentPosition(layout, root);
  if (!useGridOffset && adjacentPosition && !adjacentPosition.ok) {
    return { layout, error: adjacentPosition.error };
  }

  const subtree = [root, ...getDescendants(layout.elements, rootId)];
  const idMap = new Map<string, string>();
  for (const el of subtree) {
    idMap.set(el.id, createElementId(el.type.slice(0, 3)));
  }

  const clones: FloorPlanElement[] = subtree.map((el) => {
    const isRoot = el.id === rootId;
    let next: FloorPlanElement = {
      ...el,
      id: idMap.get(el.id)!,
      parentId: isRoot ? el.parentId : idMap.get(el.parentId!) ?? el.parentId,
      row: el.row,
      column: el.column,
      name: isRoot && el.type !== "seat" ? `${el.name} Copy` : el.name,
      seatId: el.type === "seat" ? undefined : el.seatId,
      mergeGroupId: undefined,
    };

    if (isRoot) {
      if (useGridOffset) {
        next = { ...next, row: el.row + offsetRow!, column: el.column + offsetColumn! };
      } else if (adjacentPosition?.ok) {
        if (isFreeformSeat(el) && adjacentPosition.x != null && adjacentPosition.y != null) {
          next = withFreeformRect(next, { x: adjacentPosition.x, y: adjacentPosition.y });
        } else {
          next = { ...next, row: adjacentPosition.row, column: adjacentPosition.column };
        }
      }
    }

    return next;
  });

  for (const clone of clones) {
    if (clone.type === "seat") {
      clone.seatId = createSeatId([...layout.elements, ...clones], "S");
      clone.name = clone.seatId;
    }
  }

  let nextLayout = layout;
  for (const clone of clones) {
    const result = addElement(nextLayout, clone);
    if (result.error) return { layout, error: result.error };
    nextLayout = result.layout;
  }

  return { layout: nextLayout, newRootId: idMap.get(rootId) };
}

export function getSelectionRoots(elements: FloorPlanElement[], selectedIds: string[]): string[] {
  const selected = new Set(selectedIds);
  return selectedIds.filter((id) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return false;
    if (!el.parentId) return true;
    return !selected.has(el.parentId);
  });
}

export function extractSubtrees(elements: FloorPlanElement[], rootIds: string[]): FloorPlanElement[] {
  const result: FloorPlanElement[] = [];
  const seen = new Set<string>();
  for (const rootId of rootIds) {
    const root = elements.find((el) => el.id === rootId);
    if (!root) continue;
    for (const el of [root, ...getDescendants(elements, rootId)]) {
      if (seen.has(el.id)) continue;
      seen.add(el.id);
      result.push({ ...el });
    }
  }
  return result;
}

export function insertClonedSubtrees(
  layout: FloorPlanLayoutState,
  clipboardElements: FloorPlanElement[],
  rootIds: string[],
  offsetRow = 2,
  offsetColumn = 2,
  seatIdElements?: FloorPlanElement[],
): { layout: FloorPlanLayoutState; newRootIds: string[]; error?: string } {
  if (!clipboardElements.length || !rootIds.length) {
    return { layout, newRootIds: [], error: "Nothing to paste." };
  }

  const idMap = new Map<string, string>();
  for (const el of clipboardElements) {
    idMap.set(el.id, createElementId(el.type.slice(0, 3)));
  }

  const clones: FloorPlanElement[] = clipboardElements.map((el) => {
    const isRoot = rootIds.includes(el.id);
    return {
      ...el,
      id: idMap.get(el.id)!,
      parentId: el.parentId ? (idMap.get(el.parentId) ?? el.parentId) : el.parentId,
      row: isRoot ? el.row + offsetRow : el.row,
      column: isRoot ? el.column + offsetColumn : el.column,
      seatId: el.type === "seat" ? undefined : el.seatId,
      mergeGroupId: undefined,
    };
  });

  const seatPool = seatIdElements ?? layout.elements;
  for (const clone of clones) {
    if (clone.type === "seat") {
      clone.seatId = createSeatId([...seatPool, ...clones], "S");
      clone.name = clone.seatId;
    }
  }

  let nextLayout = layout;
  for (const clone of clones) {
    const result = addElement(nextLayout, clone);
    if (result.error) return { layout, error: result.error, newRootIds: [] };
    nextLayout = result.layout;
  }

  return {
    layout: nextLayout,
    newRootIds: rootIds.map((id) => idMap.get(id)!).filter(Boolean),
  };
}

export function getSeatDisplayName(element: FloorPlanElement): string {
  if (element.type !== "seat") return element.name;
  const defaultLabel = getElementDefinition("seat").label;
  if (element.name && element.name !== defaultLabel) {
    return element.name;
  }
  return element.seatId ?? element.name;
}

export function createBulkSeats(
  layout: FloorPlanLayoutState,
  options: BulkSeatOptions,
): { layout: FloorPlanLayoutState; error?: string; seatIds?: string[] } {
  const seats: FloorPlanElement[] = [];
  const prefix = options.idPrefix ?? "S";
  let counter = 1;
  const total = options.matrixRows * options.matrixColumns;

  for (let r = 0; r < options.matrixRows; r += 1) {
    for (let c = 0; c < options.matrixColumns; c += 1) {
      const index =
        options.direction === "left-to-right"
          ? r * options.matrixColumns + c
          : c * options.matrixRows + r;
      const seatId = `${prefix}${index + counter}`;
      const row =
        options.direction === "left-to-right"
          ? options.startRow + r
          : options.startRow + c;
      const column =
        options.direction === "left-to-right"
          ? options.startColumn + c
          : options.startColumn + r;

      seats.push(
        createElement("seat", {
          parentId: options.parentId,
          row,
          column,
          seatId,
        }),
      );
    }
  }

  if (seats.length !== total) {
    return { layout, error: "Invalid bulk seat configuration." };
  }

  let nextLayout = layout;
  const capCheck = validateContainerCapacity(layout, options.parentId, seats.length);
  if (!capCheck.ok) {
    return { layout, error: capCheck.reason };
  }

  const createdIds: string[] = [];
  for (const seat of seats) {
    const result = addElement(nextLayout, seat);
    if (result.error) {
      return { layout, error: result.error };
    }
    nextLayout = result.layout;
    createdIds.push(seat.seatId!);
  }

  return { layout: nextLayout, seatIds: createdIds };
}

export function createBulkFreeformSeats(
  layout: FloorPlanLayoutState,
  options: BulkFreeformSeatOptions,
): { layout: FloorPlanLayoutState; error?: string; elementIds?: string[] } {
  const count = Math.max(1, options.count);
  const bounds = getContainerPixelBounds(layout.elements, options.parentId, layout.grid);
  const { positions, valid } = computeBulkFreeformSeatPositions(
    options.startX,
    options.startY,
    count,
    bounds,
  );

  if (!valid || positions.length !== count) {
    return { layout, error: "Not enough space in this area for all seats." };
  }

  const capCheck = validateContainerCapacity(layout, options.parentId, count);
  if (!capCheck.ok) {
    return { layout, error: capCheck.reason };
  }

  const seats: FloorPlanElement[] = [];
  for (const pos of positions) {
    seats.push(
      createElement("seat", {
        parentId: options.parentId,
        seatId: createSeatId([...layout.elements, ...seats]),
        properties: createFreeformSeatProperties(
          pos.x,
          pos.y,
          DEFAULT_SEAT_WIDTH,
          DEFAULT_SEAT_HEIGHT,
        ),
      }),
    );
  }

  let nextLayout = layout;
  const createdIds: string[] = [];
  for (const seat of seats) {
    const result = addElement(nextLayout, seat);
    if (result.error) {
      return { layout, error: result.error };
    }
    nextLayout = result.layout;
    createdIds.push(seat.id);
  }

  return { layout: nextLayout, elementIds: createdIds };
}

export function computeBulkRowLayout(
  count: number,
  itemWidth: number,
  itemHeight: number,
  containerColumns: number,
  startColumn: number,
): { matrixRows: number; matrixColumns: number; itemsPerRow: number; blockWidth: number; blockHeight: number } {
  if (count <= 0) {
    return { matrixRows: 0, matrixColumns: 0, itemsPerRow: 0, blockWidth: 0, blockHeight: 0 };
  }
  const availableCols = Math.max(1, containerColumns - startColumn);
  const itemsPerRow = Math.max(1, Math.floor(availableCols / itemWidth));
  const matrixRows = Math.ceil(count / itemsPerRow);
  const matrixColumns = Math.min(count, itemsPerRow);
  return {
    matrixRows,
    matrixColumns,
    itemsPerRow,
    blockWidth: matrixColumns * itemWidth,
    blockHeight: matrixRows * itemHeight,
  };
}

/** @deprecated Use computeBulkRowLayout with container width for row-wise placement. */
export function computeBulkMatrix(count: number): { matrixRows: number; matrixColumns: number } {
  if (count <= 0) return { matrixRows: 0, matrixColumns: 0 };
  if (count === 1) return { matrixRows: 1, matrixColumns: 1 };
  return { matrixRows: 1, matrixColumns: count };
}

function getContainerBounds(
  layout: FloorPlanLayoutState,
  parentId: string | null,
): { rows: number; columns: number } {
  const parent = getParentElement(layout.elements, parentId);
  return parent ? { rows: parent.height, columns: parent.width } : layout.grid;
}

export function getBulkBlockFootprint(
  layout: FloorPlanLayoutState,
  type: FloorPlanElementType,
  count: number,
  parentId: string | null,
  startColumn: number,
): { width: number; height: number; matrixRows: number; matrixColumns: number; itemsPerRow: number } {
  const def = getElementDefinition(type);
  const bounds = getContainerBounds(layout, parentId);
  const rowLayout = computeBulkRowLayout(
    count,
    def.defaultWidth,
    def.defaultHeight,
    bounds.columns,
    startColumn,
  );
  return {
    matrixRows: rowLayout.matrixRows,
    matrixColumns: rowLayout.matrixColumns,
    itemsPerRow: rowLayout.itemsPerRow,
    width: rowLayout.blockWidth,
    height: rowLayout.blockHeight,
  };
}

export function createBulkElements(
  layout: FloorPlanLayoutState,
  type: FloorPlanElementType,
  options: BulkElementOptions,
): { layout: FloorPlanLayoutState; error?: string; elementIds?: string[] } {
  const count = Math.max(1, options.count);
  if (count === 1) {
    const def = getElementDefinition(type);
    const element = createElement(type, {
      parentId: options.parentId,
      row: options.startRow,
      column: options.startColumn,
      width: def.defaultWidth,
      height: def.defaultHeight,
      seatId: type === "seat" ? createSeatId(layout.elements) : undefined,
      name: type === "room" ? createRoomName(layout.elements) : undefined,
    });
    const result = addElement(layout, element);
    if (result.error) return { layout, error: result.error };
    return { layout: result.layout, elementIds: [element.id] };
  }

  if (type === "seat") {
    return createBulkFreeformSeats(layout, {
      parentId: options.parentId,
      startX: options.startColumn * BUILDER_CELL_STRIDE,
      startY: options.startRow * BUILDER_CELL_STRIDE,
      count,
    });
  }

  const def = getElementDefinition(type);
  const bounds = getContainerBounds(layout, options.parentId);
  const { itemsPerRow, matrixRows } = computeBulkRowLayout(
    count,
    def.defaultWidth,
    def.defaultHeight,
    bounds.columns,
    options.startColumn,
  );
  if (options.startRow + matrixRows * def.defaultHeight > bounds.rows) {
    return { layout, error: "Not enough rows in this area for all elements." };
  }

  const elements: FloorPlanElement[] = [];

  for (let index = 0; index < count; index += 1) {
    const r = Math.floor(index / itemsPerRow);
    const c = index % itemsPerRow;
    elements.push(
      createElement(type, {
        parentId: options.parentId,
        row: options.startRow + r * def.defaultHeight,
        column: options.startColumn + c * def.defaultWidth,
        width: def.defaultWidth,
        height: def.defaultHeight,
        name: type === "room" ? createRoomName([...layout.elements, ...elements]) : undefined,
      }),
    );
  }

  let nextLayout = layout;
  const createdIds: string[] = [];
  for (const element of elements) {
    const result = addElement(nextLayout, element);
    if (result.error) {
      return { layout, error: result.error };
    }
    nextLayout = result.layout;
    createdIds.push(element.id);
  }

  return { layout: nextLayout, elementIds: createdIds };
}

export function mergeSeats(
  layout: FloorPlanLayoutState,
  seatElementIds: string[],
): { layout: FloorPlanLayoutState; error?: string; groupId?: string } {
  if (seatElementIds.length < 2) {
    return { layout, error: "Select at least two seats to merge." };
  }

  const seats = layout.elements.filter(
    (el) => seatElementIds.includes(el.id) && el.type === "seat",
  );
  if (seats.length !== seatElementIds.length) {
    return { layout, error: "Only seat elements can be merged." };
  }

  const parentIds = new Set(seats.map((s) => s.parentId));
  if (parentIds.size > 1) {
    return { layout, error: "Merged seats must share the same parent." };
  }

  if (seats.some((s) => s.width !== 1 || s.height !== 1)) {
    return { layout, error: "Split merged seats before merging again." };
  }

  const minRow = Math.min(...seats.map((s) => s.row));
  const maxRow = Math.max(...seats.map((s) => s.row));
  const minCol = Math.min(...seats.map((s) => s.column));
  const maxCol = Math.max(...seats.map((s) => s.column));
  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;

  const cellSet = new Set(seats.map((s) => `${s.row},${s.column}`));
  if (cellSet.size !== seats.length) {
    return { layout, error: "Seats must occupy unique grid cells." };
  }

  for (let r = minRow; r <= maxRow; r += 1) {
    for (let c = minCol; c <= maxCol; c += 1) {
      if (!cellSet.has(`${r},${c}`)) {
        return { layout, error: "Seats must form a solid rectangle with no gaps." };
      }
    }
  }

  const primary = [...seats].sort((a, b) =>
    (a.seatId ?? a.name).localeCompare(b.seatId ?? b.name, undefined, { numeric: true }),
  )[0];

  const merged: FloorPlanElement = {
    ...primary,
    row: minRow,
    column: minCol,
    width,
    height,
    mergeGroupId: undefined,
    name: primary.name,
  };

  const withoutOthers = layout.elements.filter((el) => !seatElementIds.includes(el.id) || el.id === primary.id);
  const validation = validatePlacement({ ...layout, elements: withoutOthers }, merged, primary.id);
  if (!validation.ok) {
    return { layout, error: validation.reason };
  }

  const removeIds = new Set(seats.filter((s) => s.id !== primary.id).map((s) => s.id));
  return {
    layout: {
      ...layout,
      elements: layout.elements
        .filter((el) => !removeIds.has(el.id))
        .map((el) => (el.id === primary.id ? merged : el)),
    },
    groupId: primary.id,
  };
}

export function splitMergedSeat(
  layout: FloorPlanLayoutState,
  seatElementId: string,
): { layout: FloorPlanLayoutState; error?: string } {
  const seat = layout.elements.find((el) => el.id === seatElementId && el.type === "seat");
  if (!seat) return { layout, error: "Seat not found." };
  if (seat.width === 1 && seat.height === 1) {
    return { layout, error: "This seat is not merged." };
  }

  const newSeats: FloorPlanElement[] = [];
  let nextLayout = layout;
  const without = nextLayout.elements.filter((el) => el.id !== seat.id);

  for (let r = 0; r < seat.height; r += 1) {
    for (let c = 0; c < seat.width; c += 1) {
      const isPrimary = r === 0 && c === 0;
      newSeats.push(
        createElement("seat", {
          parentId: seat.parentId,
          row: seat.row + r,
          column: seat.column + c,
          seatId: isPrimary ? seat.seatId : createSeatId([...without, ...newSeats]),
          name: isPrimary ? seat.name : createSeatId([...without, ...newSeats]),
        }),
      );
    }
  }

  nextLayout = { ...layout, elements: without };
  for (const newSeat of newSeats) {
    const result = addElement(nextLayout, newSeat);
    if (result.error) return { layout, error: result.error };
    nextLayout = result.layout;
  }

  return { layout: nextLayout };
}

export function unmergeSeats(
  layout: FloorPlanLayoutState,
  groupId: string,
): FloorPlanLayoutState {
  const seat = layout.elements.find((el) => el.id === groupId && el.type === "seat");
  if (seat && (seat.width > 1 || seat.height > 1)) {
    return splitMergedSeat(layout, groupId).layout;
  }
  return {
    ...layout,
    elements: layout.elements.map((el) =>
      el.mergeGroupId === groupId ? { ...el, mergeGroupId: undefined } : el,
    ),
  };
}

export function resizeFloorGrid(
  layout: FloorPlanLayoutState,
  grid: FloorPlanGrid,
  opts?: { rowOffset?: number; columnOffset?: number },
): FloorPlanLayoutState {
  const rowOffset = opts?.rowOffset ?? 0;
  const columnOffset = opts?.columnOffset ?? 0;
  if (rowOffset === 0 && columnOffset === 0) {
    return { ...layout, grid };
  }
  return {
    ...layout,
    grid,
    elements: layout.elements.map((el) => {
      if (el.parentId !== null) return el;

      if (isFreeformSeat(el)) {
        const rect = getFreeformRect(el);
        return withFreeformRect(el, {
          x: rect.x + columnOffset * CANVAS_BOUNDS_PX,
          y: rect.y + rowOffset * CANVAS_BOUNDS_PX,
        });
      }

      return {
        ...el,
        row: el.row + rowOffset,
        column: el.column + columnOffset,
      };
    }),
  };
}

export function resolvePlacementTarget(
  layout: FloorPlanLayoutState,
  childType: FloorPlanElementType,
  worldRow: number,
  worldColumn: number,
  preferredParentId?: string | null,
): { parentId: string | null; row: number; column: number } {
  if (preferredParentId) {
    const parent = getParentElement(layout.elements, preferredParentId);
    if (parent && canPlaceInParent(childType, parent.type)) {
      const world = getWorldFootprint(layout.elements, parent);
      return {
        parentId: preferredParentId,
        row: worldRow - world.worldRow,
        column: worldColumn - world.worldColumn,
      };
    }
  }

  const hit = findContainerAtWorldCell(layout.elements, worldRow, worldColumn, childType);
  if (hit) {
    return {
      parentId: hit.container.id,
      row: hit.localRow,
      column: hit.localColumn,
    };
  }

  return { parentId: null, row: worldRow, column: worldColumn };
}

export function snapDropPosition(
  layout: FloorPlanLayoutState,
  type: FloorPlanElementType,
  parentId: string | null,
  pointerRow: number,
  pointerColumn: number,
  width?: number,
  height?: number,
  ignoreElementId?: string,
): Footprint | null {
  const def = getElementDefinition(type);
  return snapFootprintStrict(
    layout,
    {
      parentId,
      row: pointerRow,
      column: pointerColumn,
      width: width ?? def.defaultWidth,
      height: height ?? def.defaultHeight,
    },
    { ignoreElementId, elementType: type },
  );
}

export function createRoomAt(
  layout: FloorPlanLayoutState,
  type: "room" | "meeting_room" | "conference_room" | "cabin",
  options: {
    name: string;
    parentId?: string | null;
    row: number;
    column: number;
    width?: number;
    height?: number;
  },
): { layout: FloorPlanLayoutState; error?: string; elementId?: string } {
  const element = createElement(type, {
    name: options.name,
    parentId: options.parentId ?? null,
    row: options.row,
    column: options.column,
    width: options.width ?? DEFAULT_ROOM_SIZE.width,
    height: options.height ?? DEFAULT_ROOM_SIZE.height,
  });
  const result = addElement(layout, element);
  if (result.error) return { layout, error: result.error };
  return { layout: result.layout, elementId: element.id };
}

export function extractSeatIds(layout: FloorPlanLayoutState): string[] {
  const blocks = layout.blocks?.length ? layout.blocks : [{ elements: layout.elements }];
  const ids = new Set<string>();
  for (const block of blocks) {
    for (const el of block.elements) {
      if (el.type === "seat" && el.seatId) ids.add(el.seatId);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export type LayoutWorldBounds = {
  minRow: number;
  minColumn: number;
  maxRow: number;
  maxColumn: number;
  width: number;
  height: number;
};

export function getLayoutWorldBounds(elements: FloorPlanElement[]): LayoutWorldBounds | null {
  if (elements.length === 0) return null;

  let minRow = Infinity;
  let minColumn = Infinity;
  let maxRow = 0;
  let maxColumn = 0;

  for (const element of elements) {
    const world = getWorldFootprint(elements, element);
    minRow = Math.min(minRow, world.worldRow);
    minColumn = Math.min(minColumn, world.worldColumn);
    maxRow = Math.max(maxRow, world.worldRow + element.height);
    maxColumn = Math.max(maxColumn, world.worldColumn + element.width);
  }

  return {
    minRow,
    minColumn,
    maxRow,
    maxColumn,
    width: maxColumn - minColumn,
    height: maxRow - minRow,
  };
}

function ensureGridFitsLayoutClone(
  layout: FloorPlanLayoutState,
  bounds: LayoutWorldBounds,
  targetWorldRow: number,
  targetWorldColumn: number,
): { layout: FloorPlanLayoutState; offsetRow: number; offsetColumn: number } {
  const offsetRow = targetWorldRow - bounds.minRow;
  const offsetColumn = targetWorldColumn - bounds.minColumn;
  const copyMinRow = bounds.minRow + offsetRow;
  const copyMinColumn = bounds.minColumn + offsetColumn;
  const copyMaxRow = bounds.maxRow + offsetRow;
  const copyMaxColumn = bounds.maxColumn + offsetColumn;

  let rows = layout.grid.rows;
  let columns = layout.grid.columns;
  let rowOffset = 0;
  let columnOffset = 0;

  if (copyMinRow < 0) {
    rowOffset = -copyMinRow;
    rows += rowOffset;
  }
  if (copyMinColumn < 0) {
    columnOffset = -copyMinColumn;
    columns += columnOffset;
  }
  if (copyMaxRow + rowOffset > rows) rows = copyMaxRow + rowOffset;
  if (copyMaxColumn + columnOffset > columns) columns = copyMaxColumn + columnOffset;

  if (
    rows === layout.grid.rows &&
    columns === layout.grid.columns &&
    rowOffset === 0 &&
    columnOffset === 0
  ) {
    return { layout, offsetRow, offsetColumn };
  }

  const expanded = resizeFloorGrid(layout, { rows, columns }, { rowOffset, columnOffset });
  const nextBounds = getLayoutWorldBounds(expanded.elements);
  if (!nextBounds) {
    return { layout: expanded, offsetRow, offsetColumn };
  }

  return {
    layout: expanded,
    offsetRow: targetWorldRow - nextBounds.minRow,
    offsetColumn: targetWorldColumn - nextBounds.minColumn,
  };
}

export function validateLayoutCloneAt(
  layout: FloorPlanLayoutState,
  targetWorldRow: number,
  targetWorldColumn: number,
): { ok: boolean; reason?: string; preview?: LayoutWorldBounds & { worldRow: number; worldColumn: number } } {
  const bounds = getLayoutWorldBounds(layout.elements);
  if (!bounds) {
    return { ok: false, reason: "Nothing to duplicate." };
  }

  const { layout: expandedLayout, offsetRow, offsetColumn } = ensureGridFitsLayoutClone(
    layout,
    bounds,
    targetWorldRow,
    targetWorldColumn,
  );

  const roots = expandedLayout.elements.filter((el) => el.parentId === null);
  let workingLayout = expandedLayout;

  for (const root of roots) {
    const subtree = [root, ...getDescendants(workingLayout.elements, root.id)];
    const idMap = new Map<string, string>();
    for (const el of subtree) {
      idMap.set(el.id, createElementId(el.type.slice(0, 3)));
    }

    const clones: FloorPlanElement[] = subtree.map((el) => {
      const isRoot = el.id === root.id;
      return {
        ...el,
        id: idMap.get(el.id)!,
        parentId: isRoot ? el.parentId : idMap.get(el.parentId!) ?? el.parentId,
        row: isRoot ? el.row + offsetRow : el.row,
        column: isRoot ? el.column + offsetColumn : el.column,
        seatId: el.type === "seat" ? undefined : el.seatId,
        mergeGroupId: undefined,
      };
    });

    for (const clone of clones) {
      if (clone.type === "seat") {
        clone.seatId = createSeatId([...workingLayout.elements, ...clones], "S");
        clone.name = clone.seatId;
      }
      const validation = validatePlacement(workingLayout, clone);
      if (!validation.ok) {
        return { ok: false, reason: validation.reason };
      }
      workingLayout = {
        ...workingLayout,
        elements: [...workingLayout.elements, clone],
      };
    }
  }

  return {
    ok: true,
    preview: {
      ...bounds,
      worldRow: targetWorldRow,
      worldColumn: targetWorldColumn,
    },
  };
}

export function duplicateEntireLayoutAt(
  layout: FloorPlanLayoutState,
  targetWorldRow: number,
  targetWorldColumn: number,
): { layout: FloorPlanLayoutState; error?: string; newRootIds?: string[] } {
  const validation = validateLayoutCloneAt(layout, targetWorldRow, targetWorldColumn);
  if (!validation.ok) {
    return { layout, error: validation.reason ?? "Cannot place layout copy here." };
  }

  const bounds = getLayoutWorldBounds(layout.elements)!;
  const { layout: expandedLayout, offsetRow, offsetColumn } = ensureGridFitsLayoutClone(
    layout,
    bounds,
    targetWorldRow,
    targetWorldColumn,
  );

  const roots = expandedLayout.elements.filter((el) => el.parentId === null);
  let nextLayout = expandedLayout;
  const newRootIds: string[] = [];

  for (const root of roots) {
    const result = duplicateSubtree(nextLayout, root.id, offsetRow, offsetColumn);
    if (result.error) {
      return { layout, error: result.error };
    }
    nextLayout = result.layout;
    if (result.newRootId) newRootIds.push(result.newRootId);
  }

  return { layout: nextLayout, newRootIds };
}
