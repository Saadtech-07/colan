import { canPlaceInParent, getElementDefinition } from "./element-registry";
import type { FloorPlanElement, FloorPlanElementType, FloorPlanGrid, Footprint } from "./types";

export function cellKey(parentId: string | null, row: number, column: number): string {
  return `${parentId ?? "floor"}:${row}:${column}`;
}

export function footprintCells(footprint: Footprint): Array<{ row: number; column: number }> {
  const cells: Array<{ row: number; column: number }> = [];
  for (let r = 0; r < footprint.height; r += 1) {
    for (let c = 0; c < footprint.width; c += 1) {
      cells.push({ row: footprint.row + r, column: footprint.column + c });
    }
  }
  return cells;
}

export class GridOccupancyMap {
  private readonly occupied = new Map<string, string>();

  constructor(
    private readonly elements: FloorPlanElement[],
    private readonly grid: FloorPlanGrid,
  ) {
    this.rebuild();
  }

  rebuild(elements?: FloorPlanElement[]) {
    this.occupied.clear();
    const list = elements ?? this.elements;
    for (const element of list) {
      if (element.type === "floor") continue;
      this.mark(element.id, {
        parentId: element.parentId,
        row: element.row,
        column: element.column,
        width: element.width,
        height: element.height,
      });
    }
  }

  private mark(elementId: string, footprint: Footprint) {
    for (const { row, column } of footprintCells(footprint)) {
      this.occupied.set(cellKey(footprint.parentId, row, column), elementId);
    }
  }

  private unmark(elementId: string, footprint: Footprint) {
    for (const { row, column } of footprintCells(footprint)) {
      const key = cellKey(footprint.parentId, row, column);
      if (this.occupied.get(key) === elementId) {
        this.occupied.delete(key);
      }
    }
  }

  isFootprintFree(footprint: Footprint, ignoreElementId?: string): boolean {
    for (const { row, column } of footprintCells(footprint)) {
      const key = cellKey(footprint.parentId, row, column);
      const owner = this.occupied.get(key);
      if (owner && owner !== ignoreElementId) return false;
    }
    return true;
  }

  fitsInParent(
    footprint: Footprint,
    parent: FloorPlanElement | null,
    grid: FloorPlanGrid,
  ): boolean {
    const bounds = parent
      ? { rows: parent.height, columns: parent.width }
      : { rows: grid.rows, columns: grid.columns };

    if (footprint.row < 0 || footprint.column < 0) return false;
    if (footprint.row + footprint.height > bounds.rows) return false;
    if (footprint.column + footprint.width > bounds.columns) return false;
    return true;
  }

  snapToGrid(
    parentId: string | null,
    pointerRow: number,
    pointerColumn: number,
    width: number,
    height: number,
  ): Footprint {
    return {
      parentId,
      row: Math.max(0, Math.round(pointerRow)),
      column: Math.max(0, Math.round(pointerColumn)),
      width,
      height,
    };
  }

  findNearestValid(
    footprint: Footprint,
    ignoreElementId: string | undefined,
    parent: FloorPlanElement | null,
    grid: FloorPlanGrid,
    maxRadius = 6,
  ): Footprint | null {
    if (
      this.fitsInParent(footprint, parent, grid) &&
      this.isFootprintFree(footprint, ignoreElementId)
    ) {
      return footprint;
    }

    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        for (let dc = -radius; dc <= radius; dc += 1) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          const candidate: Footprint = {
            ...footprint,
            row: footprint.row + dr,
            column: footprint.column + dc,
          };
          if (
            this.fitsInParent(candidate, parent, grid) &&
            this.isFootprintFree(candidate, ignoreElementId)
          ) {
            return candidate;
          }
        }
      }
    }
    return null;
  }
}

export function getParentElement(
  elements: FloorPlanElement[],
  parentId: string | null,
): FloorPlanElement | null {
  if (!parentId) return null;
  return elements.find((el) => el.id === parentId) ?? null;
}

export function getDescendants(
  elements: FloorPlanElement[],
  rootId: string,
): FloorPlanElement[] {
  const result: FloorPlanElement[] = [];
  const queue = elements.filter((el) => el.parentId === rootId);
  while (queue.length) {
    const next = queue.shift()!;
    result.push(next);
    queue.push(...elements.filter((el) => el.parentId === next.id));
  }
  return result;
}

export function getWorldFootprint(
  elements: FloorPlanElement[],
  element: FloorPlanElement,
): { worldRow: number; worldColumn: number } {
  let worldRow = element.row;
  let worldColumn = element.column;
  let currentParentId = element.parentId;

  while (currentParentId) {
    const parent = elements.find((el) => el.id === currentParentId);
    if (!parent) break;
    worldRow += parent.row;
    worldColumn += parent.column;
    currentParentId = parent.parentId;
  }

  return { worldRow, worldColumn };
}

export function findContainerAtWorldCell(
  elements: FloorPlanElement[],
  worldRow: number,
  worldColumn: number,
  childType: FloorPlanElementType,
): { container: FloorPlanElement; localRow: number; localColumn: number } | null {
  const candidates = elements.filter((el) => {
    const def = getElementDefinition(el.type);
    if (!def.supportsChildren || !canPlaceInParent(childType, el.type)) return false;
    const world = getWorldFootprint(elements, el);
    return (
      worldRow >= world.worldRow &&
      worldRow < world.worldRow + el.height &&
      worldColumn >= world.worldColumn &&
      worldColumn < world.worldColumn + el.width
    );
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.width * a.height - b.width * b.height);
  const container = candidates[0];
  const world = getWorldFootprint(elements, container);
  return {
    container,
    localRow: worldRow - world.worldRow,
    localColumn: worldColumn - world.worldColumn,
  };
}

export function moveElementTree(
  elements: FloorPlanElement[],
  rootId: string,
  deltaRow: number,
  deltaColumn: number,
): FloorPlanElement[] {
  const ids = new Set([rootId, ...getDescendants(elements, rootId).map((el) => el.id)]);
  return elements.map((el) => {
    if (!ids.has(el.id)) return el;
    if (el.id === rootId) {
      return {
        ...el,
        row: el.row + deltaRow,
        column: el.column + deltaColumn,
      };
    }
    return el;
  });
}
