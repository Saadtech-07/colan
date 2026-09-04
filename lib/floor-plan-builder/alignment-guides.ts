import { getFreeformRect, getWorldPixelRect, isFreeformSeat } from "./freeform-geometry";
import { getWorldFootprint } from "./hierarchy";
import type { FloorPlanElement } from "./types";

export type AlignmentGuideLine = {
  axis: "horizontal" | "vertical";
  position: number;
  spanStart: number;
  spanEnd: number;
  kind: "edge" | "center" | "spacing";
  /** When true, position/span values are canvas pixels (not grid cells). */
  pixel?: boolean;
};

type ElementBounds = {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

const GRID_SNAP_THRESHOLD = 0.4;
const PIXEL_ALIGN_THRESHOLD = 6;

function getGridElementBounds(
  elements: FloorPlanElement[],
  element: FloorPlanElement,
): ElementBounds {
  const world = getWorldFootprint(elements, element);
  return {
    id: element.id,
    left: world.worldColumn,
    right: world.worldColumn + element.width,
    top: world.worldRow,
    bottom: world.worldRow + element.height,
    centerX: world.worldColumn + element.width / 2,
    centerY: world.worldRow + element.height / 2,
  };
}

function collectComparableGridBounds(
  elements: FloorPlanElement[],
  activeElement: FloorPlanElement,
  excludeIds: Set<string>,
): ElementBounds[] {
  const bounds: ElementBounds[] = [];
  for (const el of elements) {
    if (el.id === activeElement.id || excludeIds.has(el.id) || el.type === "floor") continue;
    if (el.parentId !== activeElement.parentId) continue;
    bounds.push(getGridElementBounds(elements, el));
  }
  return bounds;
}

function pushGuide(guides: AlignmentGuideLine[], guide: AlignmentGuideLine) {
  const exists = guides.some(
    (g) =>
      g.axis === guide.axis &&
      Math.abs(g.position - guide.position) < (guide.pixel ? 1 : 0.01) &&
      g.kind === guide.kind,
  );
  if (!exists) guides.push(guide);
}

export type AlignmentSnapResult = {
  row: number;
  column: number;
  guides: AlignmentGuideLine[];
};

/** Grid-cell alignment snap (non-freeform elements only). */
export function applyAlignmentSnap(
  elements: FloorPlanElement[],
  activeElement: FloorPlanElement,
  localRow: number,
  localColumn: number,
  excludeIds: Set<string> = new Set(),
): AlignmentSnapResult {
  const activeWorld = getWorldFootprint(elements, {
    ...activeElement,
    row: localRow,
    column: localColumn,
  });

  const active: ElementBounds = {
    id: activeElement.id,
    left: activeWorld.worldColumn,
    right: activeWorld.worldColumn + activeElement.width,
    top: activeWorld.worldRow,
    bottom: activeWorld.worldRow + activeElement.height,
    centerX: activeWorld.worldColumn + activeElement.width / 2,
    centerY: activeWorld.worldRow + activeElement.height / 2,
  };

  const others = collectComparableGridBounds(elements, activeElement, excludeIds);
  const guides: AlignmentGuideLine[] = [];

  let snapColumn = localColumn;
  let snapRow = localRow;
  let bestColDelta = GRID_SNAP_THRESHOLD + 1;
  let bestRowDelta = GRID_SNAP_THRESHOLD + 1;

  const activeV = [active.left, active.centerX, active.right];
  const activeH = [active.top, active.centerY, active.bottom];

  for (const other of others) {
    const otherV = [
      { pos: other.left, kind: "edge" as const },
      { pos: other.centerX, kind: "center" as const },
      { pos: other.right, kind: "edge" as const },
    ];
    const otherH = [
      { pos: other.top, kind: "edge" as const },
      { pos: other.centerY, kind: "center" as const },
      { pos: other.bottom, kind: "edge" as const },
    ];

    for (const av of activeV) {
      for (const ov of otherV) {
        const delta = Math.abs(av - ov.pos);
        if (delta <= GRID_SNAP_THRESHOLD && delta < bestColDelta) {
          bestColDelta = delta;
          snapColumn = localColumn + (ov.pos - av);
          guides.length = 0;
          pushGuide(guides, {
            axis: "vertical",
            position: ov.pos,
            spanStart: Math.min(active.top, other.top),
            spanEnd: Math.max(active.bottom, other.bottom),
            kind: ov.kind,
          });
        } else if (delta <= GRID_SNAP_THRESHOLD) {
          pushGuide(guides, {
            axis: "vertical",
            position: ov.pos,
            spanStart: Math.min(active.top, other.top),
            spanEnd: Math.max(active.bottom, other.bottom),
            kind: ov.kind,
          });
        }
      }
    }

    for (const ah of activeH) {
      for (const oh of otherH) {
        const delta = Math.abs(ah - oh.pos);
        if (delta <= GRID_SNAP_THRESHOLD && delta < bestRowDelta) {
          bestRowDelta = delta;
          snapRow = localRow + (oh.pos - ah);
          pushGuide(guides, {
            axis: "horizontal",
            position: oh.pos,
            spanStart: Math.min(active.left, other.left),
            spanEnd: Math.max(active.right, other.right),
            kind: oh.kind,
          });
        } else if (delta <= GRID_SNAP_THRESHOLD) {
          pushGuide(guides, {
            axis: "horizontal",
            position: oh.pos,
            spanStart: Math.min(active.left, other.left),
            spanEnd: Math.max(active.right, other.right),
            kind: oh.kind,
          });
        }
      }
    }
  }

  return {
    row: Math.max(0, Math.round(snapRow)),
    column: Math.max(0, Math.round(snapColumn)),
    guides,
  };
}

function rectToBounds(rect: { x: number; y: number; width: number; height: number }): ElementBounds {
  return {
    id: "",
    left: rect.x,
    right: rect.x + rect.width,
    top: rect.y,
    bottom: rect.y + rect.height,
    centerX: rect.x + rect.width / 2,
    centerY: rect.y + rect.height / 2,
  };
}

function getComparablePixelBounds(
  elements: FloorPlanElement[],
  activeElement: FloorPlanElement,
  excludeIds: Set<string>,
): ElementBounds[] {
  const bounds: ElementBounds[] = [];
  for (const el of elements) {
    if (el.id === activeElement.id || excludeIds.has(el.id) || el.type === "floor") continue;
    if (el.parentId !== activeElement.parentId) continue;
    bounds.push(rectToBounds(getWorldPixelRect(elements, el)));
  }
  return bounds;
}

/**
 * Visual-only alignment guides for free-form seats (no position snapping).
 * Guide positions are in block-sheet pixel coordinates.
 */
export function computeFreeformAlignmentGuides(
  elements: FloorPlanElement[],
  activeElement: FloorPlanElement,
  candidateX: number,
  candidateY: number,
  excludeIds: Set<string> = new Set(),
): AlignmentGuideLine[] {
  const size = getFreeformRect(activeElement);
  const candidateStub = {
    ...activeElement,
    properties: {
      ...activeElement.properties,
      freeform: true,
      x: candidateX,
      y: candidateY,
      canvasWidth: size.width,
      canvasHeight: size.height,
    },
  };
  const activeWorld = getWorldPixelRect(elements, candidateStub);
  const active = rectToBounds(activeWorld);

  const others = getComparablePixelBounds(elements, activeElement, excludeIds);
  const guides: AlignmentGuideLine[] = [];

  const activeV = [
    { pos: active.left, kind: "edge" as const },
    { pos: active.centerX, kind: "center" as const },
    { pos: active.right, kind: "edge" as const },
  ];
  const activeH = [
    { pos: active.top, kind: "edge" as const },
    { pos: active.centerY, kind: "center" as const },
    { pos: active.bottom, kind: "edge" as const },
  ];

  for (const other of others) {
    const otherV = [
      { pos: other.left, kind: "edge" as const },
      { pos: other.centerX, kind: "center" as const },
      { pos: other.right, kind: "edge" as const },
    ];
    const otherH = [
      { pos: other.top, kind: "edge" as const },
      { pos: other.centerY, kind: "center" as const },
      { pos: other.bottom, kind: "edge" as const },
    ];

    for (const av of activeV) {
      for (const ov of otherV) {
        if (Math.abs(av.pos - ov.pos) <= PIXEL_ALIGN_THRESHOLD) {
          pushGuide(guides, {
            axis: "vertical",
            position: ov.pos,
            spanStart: Math.min(active.top, other.top),
            spanEnd: Math.max(active.bottom, other.bottom),
            kind: av.kind === "center" || ov.kind === "center" ? "center" : "edge",
            pixel: true,
          });
        }
      }
    }

    for (const ah of activeH) {
      for (const oh of otherH) {
        if (Math.abs(ah.pos - oh.pos) <= PIXEL_ALIGN_THRESHOLD) {
          pushGuide(guides, {
            axis: "horizontal",
            position: oh.pos,
            spanStart: Math.min(active.left, other.left),
            spanEnd: Math.max(active.right, other.right),
            kind: ah.kind === "center" || oh.kind === "center" ? "center" : "edge",
            pixel: true,
          });
        }
      }
    }
  }

  return guides;
}

export function getElementsInWorldRect(
  elements: FloorPlanElement[],
  worldRowStart: number,
  worldColumnStart: number,
  worldRowEnd: number,
  worldColumnEnd: number,
): string[] {
  const minRow = Math.min(worldRowStart, worldRowEnd);
  const maxRow = Math.max(worldRowStart, worldRowEnd);
  const minCol = Math.min(worldColumnStart, worldColumnEnd);
  const maxCol = Math.max(worldColumnStart, worldColumnEnd);

  const ids: string[] = [];
  for (const el of elements) {
    if (el.type === "floor") continue;
    const world = getWorldFootprint(elements, el);
    const elRight = world.worldColumn + el.width;
    const elBottom = world.worldRow + el.height;
    const intersects =
      world.worldColumn < maxCol &&
      elRight > minCol &&
      world.worldRow < maxRow &&
      elBottom > minRow;
    if (intersects) ids.push(el.id);
  }
  return ids;
}
