"use client";

import * as React from "react";
import { BuilderGridSeatTile } from "@/components/floor-plan-builder/builder-grid-seat-tile";
import { getElementDefinition } from "@/lib/floor-plan-builder/element-registry";
import { getWorldFootprint } from "@/lib/floor-plan-builder/hierarchy";
import {
  computeResizePatch,
  getBulkBlockFootprint,
  resolvePlacementTarget,
  snapDropPosition,
  snapFootprintStrict,
  snapRotationDegrees,
} from "@/lib/floor-plan-builder/layout-engine";
import { elementPixelSize } from "@/lib/floor-plan-builder/metrics";
import type { ResizeEdge } from "@/lib/floor-plan-builder/placement-utils";
import {
  BUILDER_CELL_GAP,
  BUILDER_CELL_PX,
  BUILDER_CELL_STRIDE,
  type FloorPlanElement,
  type FloorPlanElementType,
} from "@/lib/floor-plan-builder/types";
import { cn } from "@/lib/utils";
import { useFloorPlanBuilder } from "./builder-store";

type DragState = {
  elementId: string;
  startClientX: number;
  startClientY: number;
  originRow: number;
  originColumn: number;
};

type ResizeState = {
  elementId: string;
  edge: ResizeEdge;
  startClientX: number;
  startClientY: number;
  origin: FloorPlanElement;
};

type PanState = { startX: number; startY: number; originPan: { x: number; y: number } };

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

function internalGridStyle(color: string) {
  return {
    backgroundImage: `
      linear-gradient(to right, ${color}44 1px, transparent 1px),
      linear-gradient(to bottom, ${color}44 1px, transparent 1px)
    `,
    backgroundSize: `${BUILDER_CELL_STRIDE}px ${BUILDER_CELL_STRIDE}px`,
  };
}

function DropPreview({
  worldRow,
  worldColumn,
  width,
  height,
  valid,
}: {
  worldRow: number;
  worldColumn: number;
  width: number;
  height: number;
  valid: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-40 rounded-lg border-2 border-dashed transition-colors",
        valid ? "border-emerald-500 bg-emerald-500/15" : "border-destructive bg-destructive/15",
      )}
      style={{
        left: worldColumn * BUILDER_CELL_STRIDE,
        top: worldRow * BUILDER_CELL_STRIDE,
        width: width * BUILDER_CELL_PX + (width - 1) * BUILDER_CELL_GAP,
        height: height * BUILDER_CELL_PX + (height - 1) * BUILDER_CELL_GAP,
      }}
    />
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

  if (isSeat) {
    return (
      <BuilderGridSeatTile
        element={element}
        selected={selected}
        interactive={false}
        onPointerDown={onPointerDown}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center border-2 text-center shadow-sm",
        "rounded-2xl",
        selected ? "overflow-visible ring-2 ring-primary ring-offset-2 ring-offset-white z-20" : "overflow-hidden",
        element.type === "pillar" && "rounded-xl bg-gradient-to-b from-slate-600 to-slate-800 text-white",
        element.type === "entrance" && "rounded-xl bg-gradient-to-b from-sky-100 to-sky-200 text-sky-900",
        element.type === "wall" && "rounded-md bg-slate-500 text-white",
        element.type === "desk" && "rounded-xl bg-slate-100",
        element.type === "meeting_table" && "rounded-xl bg-violet-100",
        def.category === "structure" &&
          !["pillar", "entrance", "wall"].includes(element.type) &&
          "bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
      )}
      style={{
        borderColor: selected ? undefined : def.borderColor,
        backgroundColor:
          ["pillar", "entrance", "wall", "desk", "meeting_table"].includes(element.type)
            ? undefined
            : `${def.color}f0`,
      }}
    >
      {def.supportsChildren ? (
        <div
          className="pointer-events-none absolute inset-1 rounded-xl"
          style={internalGridStyle(def.borderColor)}
        />
      ) : null}

      {element.type === "pillar" ? (
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Pillar</span>
      ) : element.type === "wall" ? (
        <span className="text-[9px] font-semibold uppercase">Wall</span>
      ) : (
        <span className="relative z-10 px-2 text-xs font-semibold leading-tight">{element.name}</span>
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

type PendingPlacement = {
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
};

type RotateState = {
  elementId: string;
  centerX: number;
  centerY: number;
};

function RotationHandle({ onRotateStart }: { onRotateStart: (event: React.PointerEvent) => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <div className="absolute left-1/2 w-0.5 -translate-x-1/2 bg-primary" style={{ top: -32, height: 24 }} />
      <div
        className="pointer-events-auto absolute left-1/2 h-5 w-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-primary bg-white shadow-md active:cursor-grabbing"
        style={{ top: -40 }}
        title="Drag to rotate"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRotateStart(e);
        }}
      />
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
  if (!getElementDefinition(element.type).supportsResize) return null;
  return (
    <>
      {EDGE_RESIZE_HANDLES.map(({ edge, className, cursor }) => (
        <div
          key={edge}
          className={cn(
            "absolute z-50 touch-none rounded-full border-2 border-primary bg-white shadow-md hover:bg-primary/10",
            className,
            cursor,
          )}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onResizeStart(edge, e);
          }}
        />
      ))}
      {CORNER_RESIZE_HANDLES.map(({ edge, className, cursor }) => (
        <div
          key={edge}
          className={cn(
            "absolute z-50 h-3.5 w-3.5 touch-none rounded-full border-2 border-primary bg-white shadow-md hover:scale-110",
            className,
            cursor,
          )}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onResizeStart(edge, e);
          }}
        />
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
    commitBulkPlacement,
    tryMoveElement,
    tryResizeElement,
    tryRotateElement,
    mergeSeatsByDrag,
    cancelPlacementDrag,
    setZoom,
    setPan,
    resizeGrid,
    registerFitToView,
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
  const [placementPreview, setPlacementPreview] = React.useState<{
    worldRow: number;
    worldColumn: number;
    width: number;
    height: number;
    valid: boolean;
  } | null>(null);

  const activeGrid = gridResizePreview ?? layout.grid;
  const canvasWidth = activeGrid.columns * BUILDER_CELL_STRIDE;
  const canvasHeight = activeGrid.rows * BUILDER_CELL_STRIDE;

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
  }, [activeGrid.rows, activeGrid.columns]);

  React.useEffect(() => {
    registerFitToView(fitToView);
    return () => registerFitToView(null);
  }, [fitToView, registerFitToView]);

  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const gridKey = `${activeGrid.rows}x${activeGrid.columns}`;

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
  }, [activeGrid.columns, activeGrid.rows, fitToView]);

  const panRef = React.useRef(pan);
  const zoomRef = React.useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();

      const rect = vp.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

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
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [setPan, setZoom]);

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

  const updatePlacementPreview = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!placementDrag) {
        pendingPlacementRef.current = null;
        setPlacementPreview(null);
        return;
      }
      const { row, column } = clientToWorldGrid(clientX, clientY);
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
    [clientToWorldGrid, layout, placementDrag],
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
  }, [cancelPlacementDrag, commitBulkPlacement, commitPlacementFootprint]);

  React.useEffect(() => {
    if (!placementDrag) {
      pendingPlacementRef.current = null;
      return;
    }

    placementCommitLock.current = false;

    const onMove = (event: PointerEvent) => {
      updatePlacementPreview(event.clientX, event.clientY);
    };

    const onUp = () => {
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

    const onMove = (event: PointerEvent) => {
      const deltaCol = Math.round((event.clientX - resize.startClientX) / (BUILDER_CELL_STRIDE * zoom));
      const deltaRow = Math.round((event.clientY - resize.startClientY) / (BUILDER_CELL_STRIDE * zoom));
      const patch = computeResizePatch(resize.origin, resize.edge, deltaRow, deltaCol);
      setResizePreview(patch ?? null);
    };

    const onUp = (event: PointerEvent) => {
      const preview = resizePreviewRef.current;
      if (preview) {
        const deltaCol = Math.round((event.clientX - resize.startClientX) / (BUILDER_CELL_STRIDE * zoom));
        const deltaRow = Math.round((event.clientY - resize.startClientY) / (BUILDER_CELL_STRIDE * zoom));
        tryResizeElement(resize.elementId, resize.edge, deltaRow, deltaCol);
      }
      setResize(null);
      setResizePreview(null);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [resize, tryResizeElement, zoom]);

  React.useEffect(() => {
    if (!drag) return;

    const onMove = (event: PointerEvent) => {
      const deltaCol = Math.round((event.clientX - drag.startClientX) / (BUILDER_CELL_STRIDE * zoom));
      const deltaRow = Math.round((event.clientY - drag.startClientY) / (BUILDER_CELL_STRIDE * zoom));
      const element = layout.elements.find((el) => el.id === drag.elementId);
      if (!element) return;

      const targetRow = drag.originRow + deltaRow;
      const targetColumn = drag.originColumn + deltaCol;
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
      const preview = dragPreviewRef.current;
      const dragged = layout.elements.find((el) => el.id === drag.elementId);

      if (dragged?.type === "seat" && dragged.width === 1 && dragged.height === 1) {
        const { row: worldRow, column: worldColumn } = clientToWorldGrid(event.clientX, event.clientY);
        const targetSeat = findSeatAtWorldCell(layout.elements, worldRow, worldColumn, dragged.id);
        if (targetSeat && targetSeat.parentId === dragged.parentId) {
          mergeSeatsByDrag(dragged.id, targetSeat.id);
          setDrag(null);
          setDragPreview(null);
          return;
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
  }, [clientToWorldGrid, drag, layout, mergeSeatsByDrag, snapEnabled, tryMoveElement, zoom]);

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
    if (event.target === event.currentTarget || event.target === floorRef.current) {
      clearSelection();
    }
  };

  const handleElementPointerDown = (element: FloorPlanElement, event: React.PointerEvent) => {
    if (canvasMode === "pan" || placementDrag) return;
    event.stopPropagation();
    select([element.id], event.shiftKey || event.ctrlKey || event.metaKey);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({
      elementId: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originRow: element.row,
      originColumn: element.column,
    });
  };

  const displayElements = layout.elements.map((element) => {
    if (drag?.elementId === element.id && dragPreview) {
      return { ...element, row: dragPreview.row, column: dragPreview.column };
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

  const sortedElements = [...displayElements].sort((a, b) => {
    const depth = (el: FloorPlanElement) => (el.parentId ? 1 : 0);
    return depth(a) - depth(b);
  });

  const draggedElement = drag ? layout.elements.find((e) => e.id === drag.elementId) : null;
  const dragWorld =
    draggedElement && dragPreview
      ? getWorldFootprint(layout.elements, { ...draggedElement, row: dragPreview.row, column: dragPreview.column })
      : null;

  return (
    <div
      ref={viewportRef}
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden bg-[#e8ecf4]",
        canvasMode === "pan" || panDrag ? "cursor-grab active:cursor-grabbing" : "",
        placementDrag ? "cursor-crosshair" : "",
      )}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          left: FLOOR_INSET,
          top: FLOOR_INSET,
        }}
      >
        <div
          ref={floorRef}
          className="relative rounded-[28px] border-2 border-slate-300/90 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
          style={{ width: canvasWidth, height: canvasHeight }}
        >
          {gridVisible ? (
            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] opacity-40"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(100,116,139,0.35) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(100,116,139,0.35) 1px, transparent 1px)
                `,
                backgroundSize: `${BUILDER_CELL_STRIDE}px ${BUILDER_CELL_STRIDE}px`,
              }}
            />
          ) : null}

          {sortedElements.map((element) => {
            const world = getWorldFootprint(displayElements, element);
            const isSelected = selection.includes(element.id);
            const isDraggingInvalid = drag?.elementId === element.id && dragPreview && !dragPreview.valid;
            const size = elementPixelSizeFromElement(element);

            return (
              <div
                key={element.id}
                data-element-root
                className={cn("absolute", isDraggingInvalid && "opacity-50")}
                style={{
                  left: (world.worldColumn + previewColumnOffset) * BUILDER_CELL_STRIDE,
                  top: (world.worldRow + previewRowOffset) * BUILDER_CELL_STRIDE,
                  transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                  transformOrigin: "center center",
                }}
              >
                <div className="relative overflow-visible" style={{ width: size.width, height: size.height }}>
                  <ElementVisual
                    element={element}
                    selected={isSelected}
                    onPointerDown={(event) => handleElementPointerDown(element, event)}
                  />
                  {isSelected && selection.length === 1 && canvasMode === "select" ? (
                    <>
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
                      {getElementDefinition(element.type).supportsRotation ? (
                        <RotationHandle
                          onRotateStart={(e) => {
                            const root = (e.currentTarget.closest("[data-element-root]") as HTMLElement | null)?.getBoundingClientRect();
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

          {placementPreview ? (
            <DropPreview
              worldRow={placementPreview.worldRow}
              worldColumn={placementPreview.worldColumn}
              width={placementPreview.width}
              height={placementPreview.height}
              valid={placementPreview.valid}
            />
          ) : null}

          {dragWorld && draggedElement && dragPreview ? (
            <DropPreview
              worldRow={dragWorld.worldRow}
              worldColumn={dragWorld.worldColumn}
              width={draggedElement.width}
              height={draggedElement.height}
              valid={dragPreview.valid}
            />
          ) : null}

          <div
            className="absolute -top-1 left-1/2 z-40 h-2 w-20 -translate-x-1/2 cursor-n-resize rounded-full bg-primary/40 hover:bg-primary/60"
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
            className="absolute -bottom-1 left-1/2 z-40 h-2 w-20 -translate-x-1/2 cursor-s-resize rounded-full bg-primary/40 hover:bg-primary/60"
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
            className="absolute -left-1 top-1/2 z-40 h-20 w-2 -translate-y-1/2 cursor-w-resize rounded-full bg-primary/40 hover:bg-primary/60"
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
            className="absolute -right-1 top-1/2 z-40 h-20 w-2 -translate-y-1/2 cursor-e-resize rounded-full bg-primary/40 hover:bg-primary/60"
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
        </div>
      </div>

      {placementDrag ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-background/95 px-4 py-2 text-xs font-medium shadow-lg ring-1 ring-border">
          Drag to place {placementDrag.quantity}× {getElementDefinition(placementDrag.type).label}. Release on a valid grid area.
        </div>
      ) : null}
    </div>
  );
}

export type { FloorPlanElementType };
