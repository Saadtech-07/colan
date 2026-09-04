"use client";

import * as React from "react";
import { BuilderGridSeatTile } from "@/components/floor-plan-builder/builder-grid-seat-tile";
import { getElementDefinition } from "@/lib/floor-plan-builder/element-registry";
import { getWorldFootprint } from "@/lib/floor-plan-builder/hierarchy";
import {
  computeResizePatch,
  getBulkBlockFootprint,
  getLayoutWorldBounds,
  resolvePlacementTarget,
  snapDropPosition,
  snapFootprintStrict,
  snapRotationDegrees,
  validateContainerCapacity,
  validateLayoutCloneAt,
} from "@/lib/floor-plan-builder/layout-engine";
import { elementPixelSize } from "@/lib/floor-plan-builder/metrics";
import {
  applyAlignmentSnap,
  computeFreeformAlignmentGuides,
  getElementsInWorldRect,
  type AlignmentGuideLine,
} from "@/lib/floor-plan-builder/alignment-guides";
import {
  CANVAS_BOUNDS_PX,
  CANVAS_DOT_SPACING,
  DEFAULT_SEAT_HEIGHT,
  DEFAULT_SEAT_WIDTH,
  computeBulkFreeformSeatPositions,
  computeFreeformResizePatch,
  findContainerAtPixel,
  getContainerPixelBounds,
  getFreeformRect,
  getWorldPixelRect,
  isFreeformSeat,
  localPointToBlockPixel,
  withFreeformRect,
  type FreeformRect,
} from "@/lib/floor-plan-builder/freeform-geometry";
import type { ResizeEdge } from "@/lib/floor-plan-builder/placement-utils";
import {
  BUILDER_CELL_GAP,
  BUILDER_CELL_PX,
  BUILDER_CELL_STRIDE,
  type FloorPlanElement,
  type FloorPlanElementType,
} from "@/lib/floor-plan-builder/types";
import { cn } from "@/lib/utils";
import {
  getWorkspaceBlockCanvasLayouts,
  getWorkspaceCanvasGridSize,
} from "@/lib/floor-plan-builder/workspace-blocks";
import {
  AlignmentGuidesOverlay,
  BUILDER_CHROME,
  buildCanvasGridStyle,
  buildInternalGridStyle,
  DimensionLabel,
  DropCellHighlight,
  SelectionBadge,
  SelectionMarquee,
} from "./builder-ui";
import { useFloorPlanBuilder } from "./builder-store";

type DragState = {
  elementId: string;
  startClientX: number;
  startClientY: number;
  originRow: number;
  originColumn: number;
  freeform?: boolean;
  originX?: number;
  originY?: number;
};

type ResizeState = {
  elementId: string;
  edge: ResizeEdge;
  startClientX: number;
  startClientY: number;
  origin: FloorPlanElement;
};

type PanState = { startX: number; startY: number; originPan: { x: number; y: number } };

type MarqueeState = {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
};

const FLOOR_INSET = 24;

function findSeatAtWorldCell(
  elements: FloorPlanElement[],
  worldRow: number,
  worldColumn: number,
  excludeId?: string,
): FloorPlanElement | null {
  let found: FloorPlanElement | null = null;
  for (const el of elements) {
    if (el.id === excludeId || el.type !== "seat" || el.width !== 1 || el.height !== 1) continue;
    const world = getWorldFootprint(elements, el);
    if (
      worldRow >= world.worldRow &&
      worldRow < world.worldRow + el.height &&
      worldColumn >= world.worldColumn &&
      worldColumn < world.worldColumn + el.width
    ) {
      found = el;
    }
  }
  return found;
}

function DropPreview({
  worldRow,
  worldColumn,
  width,
  height,
  valid,
  showCells = true,
}: {
  worldRow: number;
  worldColumn: number;
  width: number;
  height: number;
  valid: boolean;
  showCells?: boolean;
}) {
  return (
    <>
      {showCells ? (
        <DropCellHighlight
          worldRow={worldRow}
          worldColumn={worldColumn}
          width={width}
          height={height}
          valid={valid}
        />
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute z-40 rounded-lg border-2 border-dashed transition-all duration-100",
          valid
            ? "border-primary/70 bg-primary/5 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
            : "border-destructive/70 bg-destructive/8 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]",
        )}
        style={{
          left: worldColumn * BUILDER_CELL_STRIDE,
          top: worldRow * BUILDER_CELL_STRIDE,
          width: width * BUILDER_CELL_PX + (width - 1) * BUILDER_CELL_GAP,
          height: height * BUILDER_CELL_PX + (height - 1) * BUILDER_CELL_GAP,
        }}
      />
    </>
  );
}

function elementPixelSizeFromElement(element: Pick<FloorPlanElement, "width" | "height">) {
  return elementPixelSize(element.width, element.height);
}

function ElementVisual({
  element,
  selected,
  onPointerDown,
}: {
  element: FloorPlanElement;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  const def = getElementDefinition(element.type);
  const isSeat = element.type === "seat";
  const isRoomOrCabin = element.type === "room" || element.type === "cabin";

  if (isSeat) {
    return (
      <div className={cn("relative h-full w-full", selected && "z-20")}>
        <BuilderGridSeatTile
          element={element}
          selected={selected}
          interactive={false}
          onPointerDown={onPointerDown}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      className={cn(
        "relative flex h-full w-full flex-col border text-center transition-shadow duration-150",
        "rounded-xl",
        isRoomOrCabin ? "items-stretch justify-start" : "items-center justify-center",
        selected
          ? "overflow-visible z-20 border-primary/60 shadow-[0_0_0_2px_rgba(59,130,246,0.25),0_8px_24px_rgba(59,130,246,0.12)]"
          : "overflow-hidden border-opacity-60 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]",
        element.type === "pillar" &&
          "rounded-lg border-slate-700/80 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_rgba(15,23,42,0.25)]",
        element.type === "entrance" &&
          "rounded-lg border-sky-300/80 bg-gradient-to-b from-sky-50 via-sky-100 to-sky-200 text-sky-900",
        element.type === "wall" &&
          "rounded-sm border-slate-600/80 bg-gradient-to-b from-slate-500 to-slate-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
        element.type === "stairs" &&
          "rounded-lg border-stone-400/70 bg-gradient-to-br from-stone-100 via-stone-200/80 to-stone-300/60 text-stone-700",
        element.type === "desk" && "rounded-lg border-slate-300/70 bg-gradient-to-b from-slate-50 to-slate-100",
        element.type === "meeting_table" && "rounded-lg border-violet-300/70 bg-gradient-to-b from-violet-50 to-violet-100",
        def.category === "structure" &&
          !["pillar", "entrance", "wall", "stairs"].includes(element.type) &&
          "bg-white/98 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_6px_20px_rgba(15,23,42,0.06)]",
      )}
      style={{
        borderColor: selected
          ? undefined
          : ["pillar", "entrance", "wall", "stairs", "desk", "meeting_table"].includes(element.type)
            ? undefined
            : def.borderColor,
        backgroundColor:
          ["pillar", "entrance", "wall", "stairs", "desk", "meeting_table"].includes(element.type)
            ? undefined
            : `${def.color}ee`,
      }}
    >
      {def.supportsChildren ? (
        <div
          className="pointer-events-none absolute inset-1.5 rounded-lg opacity-60"
          style={buildInternalGridStyle(def.borderColor)}
        />
      ) : null}

      {element.type === "pillar" ? (
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-90">Pillar</span>
      ) : element.type === "wall" ? (
        <span className="text-[8px] font-semibold uppercase tracking-wider opacity-90">Wall</span>
      ) : element.type === "stairs" ? (
        <div className="relative z-10 flex flex-col items-center gap-0.5">
          <div className="flex flex-col gap-px">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-px w-6 bg-stone-500/40" />
            ))}
          </div>
          <span className="text-[9px] font-semibold">{element.name}</span>
        </div>
      ) : element.type === "entrance" ? (
        <div className="relative z-10 flex flex-col items-center gap-0.5">
          <div className="h-3 w-5 rounded-t-full border-2 border-b-0 border-sky-500/50" />
          <span className="text-[9px] font-semibold">{element.name}</span>
        </div>
      ) : isRoomOrCabin ? (
        <span className="relative z-10 px-2 pt-2 text-[11px] font-bold leading-tight text-foreground/90">
          {element.name}
        </span>
      ) : (
        <span className="relative z-10 px-2 text-[11px] font-semibold leading-tight text-foreground/90">
          {element.name}
        </span>
      )}
    </div>
  );
}

const EDGE_RESIZE_HANDLES: {
  edge: ResizeEdge;
  className: string;
  cursor: string;
}[] = [
  { edge: "n", className: "left-4 right-4 top-0 h-3 -translate-y-1/2", cursor: "cursor-n-resize" },
  { edge: "s", className: "bottom-0 left-4 right-4 h-3 translate-y-1/2", cursor: "cursor-s-resize" },
  { edge: "e", className: "right-0 top-4 bottom-4 w-3 translate-x-1/2", cursor: "cursor-e-resize" },
  { edge: "w", className: "left-0 top-4 bottom-4 w-3 -translate-x-1/2", cursor: "cursor-w-resize" },
];

const CORNER_RESIZE_HANDLES: {
  edge: ResizeEdge;
  className: string;
  cursor: string;
}[] = [
  { edge: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-nw-resize" },
  { edge: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "cursor-ne-resize" },
  { edge: "se", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2", cursor: "cursor-se-resize" },
  { edge: "sw", className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "cursor-sw-resize" },
];

type PendingPlacement =
  | {
      mode: "element";
      valid: boolean;
      type: FloorPlanElementType;
      quantity: number;
      parentId: string | null;
      row: number;
      column: number;
      width: number;
      height: number;
      previewWidth: number;
      previewHeight: number;
    }
  | {
      mode: "freeform-seat";
      valid: boolean;
      localX: number;
      localY: number;
      quantity?: number;
      parentId?: string | null;
    }
  | {
      mode: "layout-clone";
      valid: boolean;
      worldRow: number;
      worldColumn: number;
      previewWidth: number;
      previewHeight: number;
    };

type RotateState = {
  elementId: string;
  centerX: number;
  centerY: number;
};

function RotationHandle({ onRotateStart }: { onRotateStart: (event: React.PointerEvent) => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <div
        className="absolute left-1/2 w-px -translate-x-1/2 bg-violet-500/50"
        style={{ top: -36, height: 28 }}
      />
      <div
        className="pointer-events-auto absolute left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-violet-500 bg-background shadow-md transition-transform hover:scale-110 active:cursor-grabbing"
        style={{ top: -44 }}
        title="Drag to rotate"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRotateStart(e);
        }}
      >
        <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />
      </div>
    </div>
  );
}

function ResizeHandles({
  element,
  onResizeStart,
}: {
  element: FloorPlanElement;
  onResizeStart: (edge: ResizeEdge, event: React.PointerEvent) => void;
}) {
  const canResize =
    isFreeformSeat(element) || getElementDefinition(element.type).supportsResize;
  if (!canResize) return null;
  return (
    <>
      <div className="pointer-events-none absolute -inset-px rounded-lg border-2 border-violet-500/90" />
      {EDGE_RESIZE_HANDLES.map(({ edge, className, cursor }) => (
        <div
          key={edge}
          className={cn(
            "absolute z-50 flex touch-none items-center justify-center",
            className,
            cursor,
          )}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onResizeStart(edge, e);
          }}
        >
          <div className="h-2 w-5 rounded-full border-2 border-violet-500/80 bg-white shadow-sm transition-transform hover:scale-110" />
        </div>
      ))}
      {CORNER_RESIZE_HANDLES.map(({ edge, className, cursor }) => (
        <div
          key={edge}
          className={cn(
            "absolute z-50 flex h-3 w-3 touch-none items-center justify-center",
            className,
            cursor,
          )}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onResizeStart(edge, e);
          }}
        >
          <div className="h-2.5 w-2.5 rounded-full border-2 border-violet-500 bg-white shadow-sm transition-transform hover:scale-125" />
        </div>
      ))}
    </>
  );
}

export function FloorPlanCanvas() {
  const {
    layout,
    selection,
    placementDrag,
    canvasMode,
    snapEnabled,
    gridVisible,
    zoom,
    pan,
    select,
    clearSelection,
    commitPlacementFootprint,
    commitFreeformSeatAt,
    commitBulkFreeformSeatsAt,
    commitBulkPlacement,
    commitLayoutCloneAt,
    tryMoveElement,
    tryMoveFreeformElement,
    tryResizeElement,
    tryResizeFreeformElement,
    tryRotateElement,
    mergeSeatsByDrag,
    cancelPlacementDrag,
    setZoom,
    setPan,
    resizeGrid,
    registerFitToView,
    workspaceBlocks,
    activeBlockId,
    switchWorkspaceBlock,
  } = useFloorPlanBuilder();

  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const floorRef = React.useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [resize, setResize] = React.useState<ResizeState | null>(null);
  const [rotate, setRotate] = React.useState<RotateState | null>(null);
  const [rotatePreview, setRotatePreview] = React.useState<0 | 90 | 180 | 270 | null>(null);
  const [panDrag, setPanDrag] = React.useState<PanState | null>(null);
  const [gridResize, setGridResize] = React.useState<{
    edge: "rows-bottom" | "rows-top" | "columns-right" | "columns-left";
    startClientX: number;
    startClientY: number;
    originRows: number;
    originColumns: number;
  } | null>(null);
  const [gridResizePreview, setGridResizePreview] = React.useState<{
    rows: number;
    columns: number;
    rowOffset: number;
    columnOffset: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = React.useState<{ row: number; column: number; valid: boolean } | null>(null);
  const [resizePreview, setResizePreview] = React.useState<Partial<FloorPlanElement> | null>(null);
  const [freeformResizePreview, setFreeformResizePreview] = React.useState<FreeformRect | null>(null);
  const [placementPreview, setPlacementPreview] = React.useState<{
    worldRow: number;
    worldColumn: number;
    width: number;
    height: number;
    valid: boolean;
    pixelMode?: boolean;
    pixelWidth?: number;
    pixelHeight?: number;
    bulkSeats?: { x: number; y: number }[];
    previewParentId?: string | null;
  } | null>(null);
  const [cursorPos, setCursorPos] = React.useState<{ x: number; y: number } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = React.useState<AlignmentGuideLine[]>([]);
  const [marquee, setMarquee] = React.useState<MarqueeState | null>(null);

  const activeGrid = gridResizePreview ?? layout.grid;
  const blockLayouts = React.useMemo(
    () => getWorkspaceBlockCanvasLayouts(workspaceBlocks),
    [workspaceBlocks],
  );
  const canvasGrid = React.useMemo(
    () => getWorkspaceCanvasGridSize(workspaceBlocks),
    [workspaceBlocks],
  );
  const canvasWidth = canvasGrid.columns * CANVAS_BOUNDS_PX;
  const canvasHeight = canvasGrid.rows * CANVAS_BOUNDS_PX;

  const fitToView = React.useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;
    if (vpW < 10 || vpH < 10) return;

    const margin = 20;
    const contentW = canvasWidth + FLOOR_INSET * 2;
    const contentH = canvasHeight + FLOOR_INSET * 2;
    const fitZoom = Math.min((vpW - margin * 2) / contentW, (vpH - margin * 2) / contentH, 1.25);
    const nextZoom = Math.max(0.25, fitZoom);
    setZoom(nextZoom);

    const scaledW = contentW * nextZoom;
    const scaledH = contentH * nextZoom;
    setPan({
      x: Math.max(margin, (vpW - scaledW) / 2),
      y: Math.max(margin, (vpH - scaledH) / 2),
    });
  }, [canvasHeight, canvasWidth, setPan, setZoom]);

  const fittedForGrid = React.useRef("");

  React.useEffect(() => {
    fittedForGrid.current = "";
  }, [activeGrid.rows, activeGrid.columns, canvasGrid.columns, canvasGrid.rows, workspaceBlocks.length]);

  React.useEffect(() => {
    registerFitToView(fitToView);
    return () => registerFitToView(null);
  }, [fitToView, registerFitToView]);

  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const gridKey = `${canvasGrid.rows}x${canvasGrid.columns}-${workspaceBlocks.length}`;

    const tryFit = () => {
      if (fittedForGrid.current === gridKey) return;
      const vpW = vp.clientWidth;
      const vpH = vp.clientHeight;
      if (vpW < 10 || vpH < 10) return;
      fitToView();
      fittedForGrid.current = gridKey;
    };

    tryFit();
    const observer = new ResizeObserver(tryFit);
    observer.observe(vp);
    return () => observer.disconnect();
  }, [canvasGrid.columns, canvasGrid.rows, fitToView, workspaceBlocks.length]);

  const panRef = React.useRef(pan);
  const zoomRef = React.useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (event: WheelEvent) => {
      const rect = vp.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();

        const currentZoom = zoomRef.current;
        const currentPan = panRef.current;
        const zoomDelta = event.deltaY > 0 ? -0.08 : 0.08;
        const nextZoom = Math.min(2, Math.max(0.35, currentZoom + zoomDelta));
        if (nextZoom === currentZoom) return;

        const scale = nextZoom / currentZoom;
        setPan({
          x: pointerX - (pointerX - currentPan.x) * scale,
          y: pointerY - (pointerY - currentPan.y) * scale,
        });
        setZoom(nextZoom);
        return;
      }

      event.preventDefault();
      const lineScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1;
      setPan({
        x: panRef.current.x - event.deltaX * lineScale,
        y: panRef.current.y - event.deltaY * lineScale,
      });
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [setPan, setZoom]);

  const clientToCanvasPixels = React.useCallback(
    (clientX: number, clientY: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return { x: 0, y: 0 };
      const vpRect = viewport.getBoundingClientRect();
      return {
        x: (clientX - vpRect.left - pan.x) / zoom - FLOOR_INSET,
        y: (clientY - vpRect.top - pan.y) / zoom - FLOOR_INSET,
      };
    },
    [pan.x, pan.y, zoom],
  );

  const clientToWorldGrid = React.useCallback(
    (clientX: number, clientY: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return { row: 0, column: 0 };
      const vpRect = viewport.getBoundingClientRect();
      const x = (clientX - vpRect.left - pan.x) / zoom - FLOOR_INSET;
      const y = (clientY - vpRect.top - pan.y) / zoom - FLOOR_INSET;
      return {
        row: Math.max(0, Math.floor(y / BUILDER_CELL_STRIDE)),
        column: Math.max(0, Math.floor(x / BUILDER_CELL_STRIDE)),
      };
    },
    [pan.x, pan.y, zoom],
  );

  const pendingPlacementRef = React.useRef<PendingPlacement | null>(null);
  const placementCommitLock = React.useRef(false);
  const dragPreviewRef = React.useRef(dragPreview);
  dragPreviewRef.current = dragPreview;
  const resizePreviewRef = React.useRef(resizePreview);
  resizePreviewRef.current = resizePreview;

  const freeformResizePreviewRef = React.useRef(freeformResizePreview);
  freeformResizePreviewRef.current = freeformResizePreview;

  const getActiveBlockOffset = React.useCallback(() => {
    const layoutEntry = blockLayouts.find(({ block }) => block.id === activeBlockId);
    return {
      x: (layoutEntry?.columnOffset ?? 0) * CANVAS_BOUNDS_PX,
      y: (layoutEntry?.rowOffset ?? 0) * CANVAS_BOUNDS_PX,
    };
  }, [activeBlockId, blockLayouts]);

  const updatePlacementPreview = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!placementDrag) {
        pendingPlacementRef.current = null;
        setPlacementPreview(null);
        return;
      }

      const { x: canvasX, y: canvasY } = clientToCanvasPixels(clientX, clientY);
      const blockOffset = getActiveBlockOffset();
      const localX = canvasX - blockOffset.x;
      const localY = canvasY - blockOffset.y;

      if (placementDrag.mode === "element" && placementDrag.type === "seat") {
        const quantity = Math.max(1, placementDrag.quantity);
        const dropX = Math.max(0, localX - DEFAULT_SEAT_WIDTH / 2);
        const dropY = Math.max(0, localY - DEFAULT_SEAT_HEIGHT / 2);
        const hit = findContainerAtPixel(layout.elements, localX, localY, "seat");
        const parentId = hit?.container.id ?? null;
        const startX = hit
          ? Math.max(0, hit.localX - DEFAULT_SEAT_WIDTH / 2)
          : dropX;
        const startY = hit
          ? Math.max(0, hit.localY - DEFAULT_SEAT_HEIGHT / 2)
          : dropY;
        const bounds = getContainerPixelBounds(layout.elements, parentId, layout.grid);
        const capacityCheck = parentId
          ? validateContainerCapacity(layout, parentId, quantity)
          : { ok: true as const };

        if (quantity <= 1) {
          const fitsBounds =
            startX >= 0 &&
            startY >= 0 &&
            startX + DEFAULT_SEAT_WIDTH <= bounds.width &&
            startY + DEFAULT_SEAT_HEIGHT <= bounds.height;
          const valid = fitsBounds && capacityCheck.ok;
          const blockPos = localPointToBlockPixel(layout.elements, parentId, startX, startY);
          pendingPlacementRef.current = {
            mode: "freeform-seat",
            valid,
            localX: startX,
            localY: startY,
            parentId,
          };
          setPlacementPreview({
            worldRow: blockPos.y,
            worldColumn: blockPos.x,
            width: 1,
            height: 1,
            valid,
            pixelMode: true,
            pixelWidth: DEFAULT_SEAT_WIDTH,
            pixelHeight: DEFAULT_SEAT_HEIGHT,
            previewParentId: parentId,
          });
          return;
        }

        const { positions, valid: fitsPositions } = computeBulkFreeformSeatPositions(
          startX,
          startY,
          quantity,
          bounds,
        );
        const valid = fitsPositions && capacityCheck.ok;
        pendingPlacementRef.current = {
          mode: "freeform-seat",
          valid,
          localX: startX,
          localY: startY,
          quantity,
          parentId,
        };
        setPlacementPreview({
          worldRow: startY,
          worldColumn: startX,
          width: 1,
          height: 1,
          valid,
          pixelMode: true,
          pixelWidth: DEFAULT_SEAT_WIDTH,
          pixelHeight: DEFAULT_SEAT_HEIGHT,
          bulkSeats: positions,
          previewParentId: parentId,
        });
        return;
      }

      const { row, column } = clientToWorldGrid(clientX, clientY);

      if (placementDrag.mode === "layout-clone") {
        const bounds = getLayoutWorldBounds(layout.elements);
        if (!bounds) {
          pendingPlacementRef.current = null;
          setPlacementPreview(null);
          return;
        }

        const validation = validateLayoutCloneAt(layout, row, column);
        pendingPlacementRef.current = {
          mode: "layout-clone",
          valid: validation.ok,
          worldRow: row,
          worldColumn: column,
          previewWidth: bounds.width,
          previewHeight: bounds.height,
        };
        setPlacementPreview({
          worldRow: row,
          worldColumn: column,
          width: bounds.width,
          height: bounds.height,
          valid: validation.ok,
        });
        return;
      }

      const def = getElementDefinition(placementDrag.type);
      const quantity = Math.max(1, placementDrag.quantity);
      const target = resolvePlacementTarget(layout, placementDrag.type, row, column, null);
      const block =
        quantity > 1
          ? getBulkBlockFootprint(layout, placementDrag.type, quantity, target.parentId, target.column)
          : { width: def.defaultWidth, height: def.defaultHeight, matrixRows: 1, matrixColumns: 1, itemsPerRow: 1 };
      const footprint = snapFootprintStrict(
        layout,
        {
          parentId: target.parentId,
          row: target.row,
          column: target.column,
          width: block.width,
          height: block.height,
        },
        { elementType: placementDrag.type },
      );
      let worldRow = row;
      let worldColumn = column;
      let previewWidth = block.width;
      let previewHeight = block.height;
      if (footprint) {
        const stub: FloorPlanElement = {
          id: "preview",
          type: placementDrag.type,
          name: def.label,
          parentId: footprint.parentId,
          row: footprint.row,
          column: footprint.column,
          width: footprint.width,
          height: footprint.height,
        };
        const world = getWorldFootprint(layout.elements, stub);
        worldRow = world.worldRow;
        worldColumn = world.worldColumn;
        previewWidth = footprint.width;
        previewHeight = footprint.height;
        pendingPlacementRef.current = {
          mode: "element",
          valid: true,
          type: placementDrag.type,
          quantity,
          parentId: footprint.parentId,
          row: footprint.row,
          column: footprint.column,
          width: def.defaultWidth,
          height: def.defaultHeight,
          previewWidth,
          previewHeight,
        };
      } else {
        pendingPlacementRef.current = {
          mode: "element",
          valid: false,
          type: placementDrag.type,
          quantity,
          parentId: target.parentId,
          row: target.row,
          column: target.column,
          width: def.defaultWidth,
          height: def.defaultHeight,
          previewWidth,
          previewHeight,
        };
      }
      setPlacementPreview({
        worldRow,
        worldColumn,
        width: previewWidth,
        height: previewHeight,
        valid: footprint !== null,
      });
    },
    [clientToCanvasPixels, clientToWorldGrid, getActiveBlockOffset, layout, placementDrag],
  );

  const commitPendingPlacement = React.useCallback(() => {
    if (placementCommitLock.current) return;
    placementCommitLock.current = true;

    const pending = pendingPlacementRef.current;
    try {
      if (!pending || !pending.valid) {
        cancelPlacementDrag();
        return;
      }
      if (pending.mode === "freeform-seat") {
        if (pending.quantity && pending.quantity > 1) {
          commitBulkFreeformSeatsAt(
            pending.localX,
            pending.localY,
            pending.quantity,
            pending.parentId ?? null,
          );
        } else {
          commitFreeformSeatAt(
            pending.localX,
            pending.localY,
            pending.parentId ?? null,
          );
        }
        return;
      }
      if (pending.mode === "layout-clone") {
        commitLayoutCloneAt(pending.worldRow, pending.worldColumn);
        return;
      }
      if (pending.quantity > 1) {
        commitBulkPlacement(pending.type, {
          parentId: pending.parentId,
          row: pending.row,
          column: pending.column,
          width: pending.previewWidth,
          height: pending.previewHeight,
        }, pending.quantity);
      } else {
        commitPlacementFootprint(pending.type, {
          parentId: pending.parentId,
          row: pending.row,
          column: pending.column,
          width: pending.width,
          height: pending.height,
        });
      }
    } finally {
      pendingPlacementRef.current = null;
      setPlacementPreview(null);
      placementCommitLock.current = false;
    }
  }, [cancelPlacementDrag, commitBulkFreeformSeatsAt, commitBulkPlacement, commitFreeformSeatAt, commitLayoutCloneAt, commitPlacementFootprint]);

  React.useEffect(() => {
    if (!placementDrag) {
      setCursorPos(null);
      pendingPlacementRef.current = null;
      return;
    }

    placementCommitLock.current = false;

    const onMove = (event: PointerEvent) => {
      setCursorPos({ x: event.clientX, y: event.clientY });
      updatePlacementPreview(event.clientX, event.clientY);
    };

    const onUp = () => {
      setCursorPos(null);
      commitPendingPlacement();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [commitPendingPlacement, placementDrag, updatePlacementPreview]);

  const rotatePreviewRef = React.useRef(rotatePreview);
  rotatePreviewRef.current = rotatePreview;

  React.useEffect(() => {
    if (!rotate) return;

    const onMove = (event: PointerEvent) => {
      const angle = Math.atan2(event.clientY - rotate.centerY, event.clientX - rotate.centerX) * (180 / Math.PI);
      setRotatePreview(snapRotationDegrees(angle + 90));
    };

    const onUp = () => {
      const preview = rotatePreviewRef.current;
      if (preview !== null) {
        tryRotateElement(rotate.elementId, preview);
      }
      setRotate(null);
      setRotatePreview(null);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [rotate, tryRotateElement]);

  React.useEffect(() => {
    if (!resize) return;

    const isFreeform = isFreeformSeat(resize.origin);

    const onMove = (event: PointerEvent) => {
      if (isFreeform) {
        const deltaX = (event.clientX - resize.startClientX) / zoom;
        const deltaY = (event.clientY - resize.startClientY) / zoom;
        const originRect = getFreeformRect(resize.origin);
        const patch = computeFreeformResizePatch(originRect, resize.edge, deltaX, deltaY);
        setFreeformResizePreview(patch);
        setResizePreview(null);
        return;
      }
      const deltaCol = Math.round((event.clientX - resize.startClientX) / (BUILDER_CELL_STRIDE * zoom));
      const deltaRow = Math.round((event.clientY - resize.startClientY) / (BUILDER_CELL_STRIDE * zoom));
      const patch = computeResizePatch(resize.origin, resize.edge, deltaRow, deltaCol);
      setResizePreview(patch ?? null);
      setFreeformResizePreview(null);
    };

    const onUp = (event: PointerEvent) => {
      if (isFreeform) {
        const deltaX = (event.clientX - resize.startClientX) / zoom;
        const deltaY = (event.clientY - resize.startClientY) / zoom;
        tryResizeFreeformElement(resize.elementId, resize.edge, deltaX, deltaY);
      } else {
        const preview = resizePreviewRef.current;
        if (preview) {
          const deltaCol = Math.round((event.clientX - resize.startClientX) / (BUILDER_CELL_STRIDE * zoom));
          const deltaRow = Math.round((event.clientY - resize.startClientY) / (BUILDER_CELL_STRIDE * zoom));
          tryResizeElement(resize.elementId, resize.edge, deltaRow, deltaCol);
        }
      }
      setResize(null);
      setResizePreview(null);
      setFreeformResizePreview(null);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [resize, tryResizeElement, tryResizeFreeformElement, zoom]);

  React.useEffect(() => {
    if (!drag) {
      if (!resize) setAlignmentGuides([]);
      return;
    }

    const onMove = (event: PointerEvent) => {
      const element = layout.elements.find((el) => el.id === drag.elementId);
      if (!element) return;

      if (drag.freeform) {
        const deltaX = (event.clientX - drag.startClientX) / zoom;
        const deltaY = (event.clientY - drag.startClientY) / zoom;
        const nextX = Math.max(0, (drag.originX ?? 0) + deltaX);
        const nextY = Math.max(0, (drag.originY ?? 0) + deltaY);
        setAlignmentGuides(
          computeFreeformAlignmentGuides(layout.elements, element, nextX, nextY),
        );
        setDragPreview({ row: nextY, column: nextX, valid: true });
        return;
      }

      const deltaCol = Math.round((event.clientX - drag.startClientX) / (BUILDER_CELL_STRIDE * zoom));
      const deltaRow = Math.round((event.clientY - drag.startClientY) / (BUILDER_CELL_STRIDE * zoom));

      let targetRow = drag.originRow + deltaRow;
      let targetColumn = drag.originColumn + deltaCol;

      if (snapEnabled) {
        const aligned = applyAlignmentSnap(layout.elements, element, targetRow, targetColumn);
        targetRow = aligned.row;
        targetColumn = aligned.column;
        setAlignmentGuides(aligned.guides);
      } else {
        setAlignmentGuides([]);
      }

      const snapped = snapEnabled
        ? snapDropPosition(
            layout,
            element.type,
            element.parentId,
            targetRow,
            targetColumn,
            element.width,
            element.height,
            drag.elementId,
          )
        : null;

      setDragPreview({
        row: snapped?.row ?? targetRow,
        column: snapped?.column ?? targetColumn,
        valid: snapped !== null,
      });
    };

    const onUp = (event: PointerEvent) => {
      setAlignmentGuides([]);
      const preview = dragPreviewRef.current;
      const dragged = layout.elements.find((el) => el.id === drag.elementId);

      if (drag.freeform) {
        if (preview?.valid) {
          tryMoveFreeformElement(drag.elementId, preview.column, preview.row);
        }
        setDrag(null);
        setDragPreview(null);
        return;
      }

      if (dragged?.type === "seat" && dragged.width === 1 && dragged.height === 1 && !isFreeformSeat(dragged)) {
        const { row: worldRow, column: worldColumn } = clientToWorldGrid(event.clientX, event.clientY);
        const targetSeat = findSeatAtWorldCell(layout.elements, worldRow, worldColumn, dragged.id);
        if (targetSeat && targetSeat.parentId === dragged.parentId) {
          const merged = mergeSeatsByDrag(dragged.id, targetSeat.id);
          if (merged) {
            setDrag(null);
            setDragPreview(null);
            return;
          }
        }
      }

      if (preview?.valid) {
        tryMoveElement(drag.elementId, preview.row, preview.column);
      }
      setDrag(null);
      setDragPreview(null);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [clientToWorldGrid, drag, layout, mergeSeatsByDrag, snapEnabled, tryMoveElement, tryMoveFreeformElement, zoom]);

  React.useEffect(() => {
    if (!marquee) return;

    const onMove = (event: PointerEvent) => {
      setMarquee((prev) =>
        prev
          ? {
              ...prev,
              currentClientX: event.clientX,
              currentClientY: event.clientY,
            }
          : null,
      );
    };

    const onUp = (event: PointerEvent) => {
      const start = clientToWorldGrid(marquee.startClientX, marquee.startClientY);
      const end = clientToWorldGrid(event.clientX, event.clientY);
      const ids = getElementsInWorldRect(
        layout.elements,
        start.row,
        start.column,
        end.row,
        end.column,
      );
      if (ids.length) {
        select(ids, event.shiftKey || event.ctrlKey || event.metaKey);
      } else if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
        clearSelection();
      }
      setMarquee(null);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [clearSelection, clientToWorldGrid, layout.elements, marquee, select]);

  const gridResizePreviewRef = React.useRef(gridResizePreview);
  gridResizePreviewRef.current = gridResizePreview;

  const applyGridResizePreview = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!gridResize) return;
      const deltaCol = Math.round(
        (clientX - gridResize.startClientX) / (BUILDER_CELL_STRIDE * zoom),
      );
      const deltaRow = Math.round(
        (clientY - gridResize.startClientY) / (BUILDER_CELL_STRIDE * zoom),
      );

      let rows = gridResize.originRows;
      let columns = gridResize.originColumns;
      let rowOffset = 0;
      let columnOffset = 0;

      switch (gridResize.edge) {
        case "rows-bottom":
          rows = Math.max(4, gridResize.originRows + deltaRow);
          break;
        case "rows-top":
          rows = Math.max(4, gridResize.originRows - deltaRow);
          rowOffset = rows - gridResize.originRows;
          break;
        case "columns-right":
          columns = Math.max(4, gridResize.originColumns + deltaCol);
          break;
        case "columns-left":
          columns = Math.max(4, gridResize.originColumns - deltaCol);
          columnOffset = columns - gridResize.originColumns;
          break;
      }

      setGridResizePreview({ rows, columns, rowOffset, columnOffset });
    },
    [gridResize, zoom],
  );

  const finishGridResize = React.useCallback(() => {
    const preview = gridResizePreviewRef.current;
    if (preview) {
      resizeGrid(
        { rows: preview.rows, columns: preview.columns },
        {
          rowOffset: preview.rowOffset,
          columnOffset: preview.columnOffset,
        },
      );
    }
    setGridResize(null);
    setGridResizePreview(null);
  }, [resizeGrid]);

  React.useEffect(() => {
    if (!gridResize) return;

    const onMove = (event: PointerEvent) => {
      applyGridResizePreview(event.clientX, event.clientY);
    };
    const onUp = () => {
      finishGridResize();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [applyGridResizePreview, finishGridResize, gridResize]);

  const handlePointerMove = (event: React.PointerEvent) => {
    if (panDrag) {
      setPan({
        x: panDrag.originPan.x + (event.clientX - panDrag.startX),
        y: panDrag.originPan.y + (event.clientY - panDrag.startY),
      });
      return;
    }

    if (gridResize) {
      applyGridResizePreview(event.clientX, event.clientY);
      return;
    }

    if (placementDrag || drag || resize) {
      return;
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (placementDrag || drag || resize) return;

    if (panDrag) {
      setPanDrag(null);
      return;
    }

    if (gridResize) {
      return;
    }
  };

  const handlePointerLeave = (event: React.PointerEvent) => {
    if (placementDrag || panDrag || drag || resize || gridResize) return;
    handlePointerUp(event);
  };

  const handleViewportPointerDown = (event: React.PointerEvent) => {
    if (canvasMode === "pan" || event.button === 1 || (event.button === 0 && event.altKey)) {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      setPanDrag({ startX: event.clientX, startY: event.clientY, originPan: pan });
      return;
    }
    if (placementDrag) {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      updatePlacementPreview(event.clientX, event.clientY);
      return;
    }
    const isEmptyTarget =
      event.target === event.currentTarget ||
      event.target === floorRef.current ||
      (event.target as HTMLElement).dataset?.blockSheet !== undefined;
    if (isEmptyTarget && canvasMode === "select") {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      setMarquee({
        startClientX: event.clientX,
        startClientY: event.clientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
      });
      return;
    }
    if (isEmptyTarget) {
      clearSelection();
    }
  };

  const handleElementPointerDown = (
    element: FloorPlanElement,
    blockId: string,
    event: React.PointerEvent,
  ) => {
    if (canvasMode === "pan" || placementDrag) return;
    event.stopPropagation();
    if (blockId !== activeBlockId) {
      switchWorkspaceBlock(blockId);
    }
    select([element.id], event.shiftKey || event.ctrlKey || event.metaKey);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    if (isFreeformSeat(element)) {
      const rect = getFreeformRect(element);
      setDrag({
        elementId: element.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originRow: 0,
        originColumn: 0,
        freeform: true,
        originX: rect.x,
        originY: rect.y,
      });
      return;
    }
    setDrag({
      elementId: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originRow: element.row,
      originColumn: element.column,
    });
  };

  const displayElements = layout.elements.map((element) => {
    if (drag?.freeform && drag.elementId === element.id && dragPreview) {
      return withFreeformRect(element, { x: dragPreview.column, y: dragPreview.row });
    }
    if (drag?.elementId === element.id && dragPreview && !drag.freeform) {
      return { ...element, row: dragPreview.row, column: dragPreview.column };
    }
    if (resize?.elementId === element.id && freeformResizePreview && isFreeformSeat(element)) {
      return withFreeformRect(element, freeformResizePreview);
    }
    if (resize?.elementId === element.id && resizePreview) {
      return { ...element, ...resizePreview };
    }
    if (rotate?.elementId === element.id && rotatePreview !== null) {
      return { ...element, rotation: rotatePreview };
    }
    return element;
  });

  const previewRowOffset = gridResizePreview?.rowOffset ?? 0;
  const previewColumnOffset = gridResizePreview?.columnOffset ?? 0;

  const draggedElement = drag ? layout.elements.find((e) => e.id === drag.elementId) : null;
  const dragWorld =
    draggedElement && dragPreview
      ? getWorldFootprint(layout.elements, { ...draggedElement, row: dragPreview.row, column: dragPreview.column })
      : null;

  return (
    <div
      ref={viewportRef}
      className={cn(
        "absolute inset-0 overflow-hidden",
        BUILDER_CHROME.canvasBg,
        canvasMode === "pan" || panDrag ? "cursor-grab active:cursor-grabbing" : "",
        placementDrag ? "cursor-crosshair" : "",
      )}
      style={{
        touchAction: "none",
        backgroundImage: BUILDER_CHROME.canvasPattern,
        backgroundSize: `${CANVAS_DOT_SPACING}px ${CANVAS_DOT_SPACING}px`,
      }}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <div
        className="absolute origin-top-left will-change-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          left: FLOOR_INSET,
          top: FLOOR_INSET,
        }}
      >
        <div
          ref={floorRef}
          className="relative"
          style={{ width: canvasWidth, height: canvasHeight }}
        >
          {blockLayouts.map(({ block, columnOffset, rowOffset }) => {
            const isActive = block.id === activeBlockId;
            const blockGrid = isActive ? activeGrid : block.grid;
            const blockElements = isActive ? displayElements : block.elements;
            const previewColOff = isActive ? previewColumnOffset : 0;
            const previewRowOff = isActive ? previewRowOffset : 0;
            const sortedBlockElements = [...blockElements].sort((a, b) => {
              const depth = (el: FloorPlanElement) => (el.parentId ? 1 : 0);
              return depth(a) - depth(b);
            });

            return (
              <div
                key={block.id}
                data-block-sheet
                className={cn(
                  "absolute transition-shadow duration-200",
                  BUILDER_CHROME.floorSheet,
                  isActive ? cn("z-10", BUILDER_CHROME.floorSheetActive) : "z-0 opacity-90 hover:opacity-100",
                )}
                style={{
                  left: columnOffset * CANVAS_BOUNDS_PX,
                  top: rowOffset * CANVAS_BOUNDS_PX,
                  width: blockGrid.columns * CANVAS_BOUNDS_PX,
                  height: blockGrid.rows * CANVAS_BOUNDS_PX,
                }}
                onPointerDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (!isActive) switchWorkspaceBlock(block.id);
                  else if (canvasMode === "select" && !placementDrag) {
                    event.stopPropagation();
                    setMarquee({
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                      currentClientX: event.clientX,
                      currentClientY: event.clientY,
                    });
                  } else clearSelection();
                }}
              >
                <div className="pointer-events-none absolute -top-8 left-4 flex items-center gap-2">
                  <span className="rounded-md bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground/80 shadow-sm ring-1 ring-border/50 backdrop-blur-sm">
                    {block.name}
                  </span>
                  {!isActive ? (
                    <span className="text-[10px] font-normal text-muted-foreground">Click to edit</span>
                  ) : null}
                </div>

                {gridVisible ? (
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[19px]"
                    style={buildCanvasGridStyle(5)}
                  />
                ) : null}

                {blockElements.length === 0 ? (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-[19px] px-8 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30">
                      <svg className="h-6 w-6 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-foreground/70">Start designing your floor</p>
                    <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
                      Drag an element from the library onto the grid
                    </p>
                  </div>
                ) : null}

                {sortedBlockElements.map((element) => {
                  const isFreeform = isFreeformSeat(element);
                  const pixelRect = isFreeform ? getWorldPixelRect(blockElements, element) : null;
                  const world = getWorldFootprint(blockElements, element);
                  const isSelected = isActive && selection.includes(element.id);
                  const isDraggingInvalid =
                    isActive && drag?.elementId === element.id && dragPreview && !dragPreview.valid;
                  const size = pixelRect
                    ? { width: pixelRect.width, height: pixelRect.height }
                    : elementPixelSizeFromElement(element);
                  const def = getElementDefinition(element.type);

                  return (
                    <div
                      key={element.id}
                      data-element-root
                      className={cn("absolute", isDraggingInvalid && "opacity-50")}
                      style={{
                        left: pixelRect
                          ? pixelRect.x + previewColOff * CANVAS_BOUNDS_PX
                          : (world.worldColumn + previewColOff) * BUILDER_CELL_STRIDE,
                        top: pixelRect
                          ? pixelRect.y + previewRowOff * CANVAS_BOUNDS_PX
                          : (world.worldRow + previewRowOff) * BUILDER_CELL_STRIDE,
                        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                        transformOrigin: "center center",
                      }}
                    >
                      <div
                        className="relative overflow-visible"
                        style={{ width: size.width, height: size.height }}
                      >
                        <ElementVisual
                          element={element}
                          selected={isSelected}
                          onPointerDown={(event) => handleElementPointerDown(element, block.id, event)}
                        />
                        {isSelected && selection.length === 1 && canvasMode === "select" ? (
                          <>
                            <SelectionBadge
                              label={def.label}
                              sublabel={
                                isFreeformSeat(element)
                                  ? `${Math.round(getFreeformRect(element).width)}×${Math.round(getFreeformRect(element).height)}`
                                  : `${element.width}×${element.height}`
                              }
                            />
                            <ResizeHandles
                              element={element}
                              onResizeStart={(edge, e) => {
                                e.stopPropagation();
                                setResize({
                                  elementId: element.id,
                                  edge,
                                  startClientX: e.clientX,
                                  startClientY: e.clientY,
                                  origin: layout.elements.find((el) => el.id === element.id) ?? element,
                                });
                              }}
                            />
                            {resize?.elementId === element.id && freeformResizePreview ? (
                              <DimensionLabel
                                width={Math.round(freeformResizePreview.width)}
                                height={Math.round(freeformResizePreview.height)}
                              />
                            ) : resize?.elementId === element.id && resizePreview ? (
                              <DimensionLabel
                                width={resizePreview.width ?? element.width}
                                height={resizePreview.height ?? element.height}
                              />
                            ) : null}
                            {getElementDefinition(element.type).supportsRotation ? (
                              <RotationHandle
                                onRotateStart={(e) => {
                                  const root = (
                                    e.currentTarget.closest("[data-element-root]") as HTMLElement | null
                                  )?.getBoundingClientRect();
                                  if (!root) return;
                                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                  setRotate({
                                    elementId: element.id,
                                    centerX: root.left + root.width / 2,
                                    centerY: root.top + root.height / 2,
                                  });
                                  const angle =
                                    Math.atan2(
                                      e.clientY - (root.top + root.height / 2),
                                      e.clientX - (root.left + root.width / 2),
                                    ) *
                                    (180 / Math.PI);
                                  setRotatePreview(snapRotationDegrees(angle + 90));
                                }}
                              />
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {isActive && placementPreview ? (
                  placementPreview.pixelMode ? (
                    placementPreview.bulkSeats?.length ? (
                      <>
                        {placementPreview.bulkSeats.map((seat, index) => {
                          const blockPos = localPointToBlockPixel(
                            blockElements,
                            placementPreview.previewParentId ?? null,
                            seat.x,
                            seat.y,
                          );
                          return (
                          <div
                            key={index}
                            className={cn(
                              "pointer-events-none absolute z-40 rounded-[10px] border-2 border-dashed transition-all duration-100",
                              placementPreview.valid
                                ? "border-violet-500/70 bg-violet-500/5"
                                : "border-destructive/70 bg-destructive/8",
                            )}
                            style={{
                              left: blockPos.x,
                              top: blockPos.y,
                              width: placementPreview.pixelWidth ?? DEFAULT_SEAT_WIDTH,
                              height: placementPreview.pixelHeight ?? DEFAULT_SEAT_HEIGHT,
                            }}
                          />
                          );
                        })}
                      </>
                    ) : (
                      <div
                        className={cn(
                          "pointer-events-none absolute z-40 rounded-[10px] border-2 border-dashed transition-all duration-100",
                          placementPreview.valid
                            ? "border-violet-500/70 bg-violet-500/5"
                            : "border-destructive/70 bg-destructive/8",
                        )}
                        style={{
                          left: placementPreview.worldColumn,
                          top: placementPreview.worldRow,
                          width: placementPreview.pixelWidth ?? DEFAULT_SEAT_WIDTH,
                          height: placementPreview.pixelHeight ?? DEFAULT_SEAT_HEIGHT,
                        }}
                      />
                    )
                  ) : (
                    <DropPreview
                      worldRow={placementPreview.worldRow}
                      worldColumn={placementPreview.worldColumn}
                      width={placementPreview.width}
                      height={placementPreview.height}
                      valid={placementPreview.valid}
                    />
                  )
                ) : null}

                {isActive && dragWorld && draggedElement && dragPreview ? (
                  <DropPreview
                    worldRow={dragWorld.worldRow}
                    worldColumn={dragWorld.worldColumn}
                    width={draggedElement.width}
                    height={draggedElement.height}
                    valid={dragPreview.valid}
                  />
                ) : null}

                {isActive && alignmentGuides.length > 0 ? (
                  <AlignmentGuidesOverlay
                    guides={alignmentGuides}
                    columnOffset={previewColOff}
                    rowOffset={previewRowOff}
                  />
                ) : null}

                {isActive ? (
                  <>
                    <div
                      className="absolute -top-1 left-1/2 z-40 h-1.5 w-16 -translate-x-1/2 cursor-n-resize rounded-full bg-primary/30 transition-colors hover:bg-primary/50"
                      title="Drag to add or remove rows from the top"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        setGridResize({
                          edge: "rows-top",
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          originRows: layout.grid.rows,
                          originColumns: layout.grid.columns,
                        });
                      }}
                    />
                    <div
                      className="absolute -bottom-1 left-1/2 z-40 h-1.5 w-16 -translate-x-1/2 cursor-s-resize rounded-full bg-primary/30 transition-colors hover:bg-primary/50"
                      title="Drag to add or remove rows from the bottom"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        setGridResize({
                          edge: "rows-bottom",
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          originRows: layout.grid.rows,
                          originColumns: layout.grid.columns,
                        });
                      }}
                    />
                    <div
                      className="absolute -left-1 top-1/2 z-40 h-16 w-1.5 -translate-y-1/2 cursor-w-resize rounded-full bg-primary/30 transition-colors hover:bg-primary/50"
                      title="Drag to add or remove columns from the left"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        setGridResize({
                          edge: "columns-left",
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          originRows: layout.grid.rows,
                          originColumns: layout.grid.columns,
                        });
                      }}
                    />
                    <div
                      className="absolute -right-1 top-1/2 z-40 h-16 w-1.5 -translate-y-1/2 cursor-e-resize rounded-full bg-primary/30 transition-colors hover:bg-primary/50"
                      title="Drag to add or remove columns from the right"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        setGridResize({
                          edge: "columns-right",
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          originRows: layout.grid.rows,
                          originColumns: layout.grid.columns,
                        });
                      }}
                    />
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {placementDrag && cursorPos && placementDrag.mode === "element" ? (
        <div
          className="pointer-events-none fixed z-[100] flex items-center gap-2 rounded-lg border border-primary/30 bg-background/95 px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur-sm"
          style={{
            left: cursorPos.x + 16,
            top: cursorPos.y + 16,
          }}
        >
          <div
            className="h-3 w-3 rounded-sm border"
            style={{
              backgroundColor: getElementDefinition(placementDrag.type).color,
              borderColor: getElementDefinition(placementDrag.type).borderColor,
            }}
          />
          {placementDrag.quantity > 1 ? `${placementDrag.quantity}× ` : ""}
          {getElementDefinition(placementDrag.type).label}
        </div>
      ) : null}

      {placementDrag ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border/50 bg-background/95 px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-sm">
          {placementDrag.mode === "layout-clone"
            ? "Release on an open area to place layout copy"
            : placementPreview?.valid
              ? "Release to place element"
              : "Invalid placement — move to an open grid area"}
        </div>
      ) : null}

      {marquee && viewportRef.current ? (
        <SelectionMarquee
          startX={marquee.startClientX - viewportRef.current.getBoundingClientRect().left}
          startY={marquee.startClientY - viewportRef.current.getBoundingClientRect().top}
          endX={marquee.currentClientX - viewportRef.current.getBoundingClientRect().left}
          endY={marquee.currentClientY - viewportRef.current.getBoundingClientRect().top}
        />
      ) : null}
    </div>
  );
}

export type { FloorPlanElementType };
