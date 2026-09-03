"use client";

import * as React from "react";
import {
  applyLayoutChange,
  canRedo,
  canUndo,
  createHistory,
  redo,
  undo,
  type CommandHistory,
} from "@/lib/floor-plan-builder/commands";
import {
  addElement,
  createBulkSeats,
  createBulkElements,
  createElement,
  createEmptyLayout,
  createRoomName,
  createSeatId,
  deleteElement,
  duplicateSubtree,
  mergeSeats,
  resizeElement,
  resizeFloorGrid,
  resolvePlacementTarget,
  snapFootprintStrict,
  splitMergedSeat,
  unmergeSeats,
  updateElement,
} from "@/lib/floor-plan-builder/layout-engine";
import { getElementDefinition } from "@/lib/floor-plan-builder/element-registry";
import type { ResizeEdge } from "@/lib/floor-plan-builder/placement-utils";
import type {
  BulkSeatOptions,
  FloorPlanElement,
  FloorPlanElementType,
  FloorPlanGrid,
  FloorPlanLayoutState,
  Footprint,
} from "@/lib/floor-plan-builder/types";

export type CanvasMode = "select" | "pan";
export type PlacementDrag = { type: FloorPlanElementType; quantity: number };

type BuilderContextValue = {
  layout: FloorPlanLayoutState;
  selection: string[];
  activeTool: FloorPlanElementType | null;
  placementDrag: PlacementDrag | null;
  canvasMode: CanvasMode;
  snapEnabled: boolean;
  gridVisible: boolean;
  zoom: number;
  pan: { x: number; y: number };
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  setActiveTool: (tool: FloorPlanElementType | null) => void;
  startPlacementDrag: (drag: PlacementDrag) => void;
  cancelPlacementDrag: () => void;
  setCanvasMode: (mode: CanvasMode) => void;
  setSnapEnabled: (value: boolean) => void;
  setGridVisible: (value: boolean) => void;
  setZoom: (value: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  select: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  commitLayout: (next: FloorPlanLayoutState, error?: string | null) => void;
  placeElementAt: (
    type: FloorPlanElementType,
    worldRow: number,
    worldColumn: number,
    parentId?: string | null,
  ) => boolean;
  commitPlacementFootprint: (type: FloorPlanElementType, footprint: Footprint) => boolean;
  commitBulkPlacement: (
    type: FloorPlanElementType,
    footprint: Footprint,
    quantity: number,
  ) => boolean;
  tryMoveElement: (elementId: string, row: number, column: number) => boolean;
  tryResizeElement: (
    elementId: string,
    edge: ResizeEdge,
    deltaRow: number,
    deltaCol: number,
  ) => boolean;
  tryRotateElement: (elementId: string, rotation: 0 | 90 | 180 | 270) => boolean;
  updateSelected: (patch: Partial<FloorPlanElement>) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  bulkCreateSeats: (options: BulkSeatOptions) => void;
  mergeSelectedSeats: () => void;
  mergeSeatsByDrag: (draggedId: string, targetId: string) => boolean;
  unmergeGroup: (groupId: string) => void;
  resizeGrid: (
    grid: FloorPlanGrid,
    opts?: { rowOffset?: number; columnOffset?: number },
  ) => void;
  undoChange: () => void;
  redoChange: () => void;
  loadLayout: (layout: FloorPlanLayoutState) => void;
  layoutRevision: number;
  registerFitToView: (fn: (() => void) | null) => void;
  fitToView: () => void;
};

const BuilderContext = React.createContext<BuilderContextValue | null>(null);

export function useFloorPlanBuilder() {
  const ctx = React.useContext(BuilderContext);
  if (!ctx) throw new Error("useFloorPlanBuilder must be used within FloorPlanBuilderProvider");
  return ctx;
}

type ProviderProps = {
  initialLayout?: FloorPlanLayoutState;
  children: React.ReactNode;
};

export function FloorPlanBuilderProvider({ initialLayout, children }: ProviderProps) {
  const historyRef = React.useRef<CommandHistory>(
    createHistory(initialLayout ?? createEmptyLayout()),
  );
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  const layoutRevisionRef = React.useRef(0);

  const [selection, setSelection] = React.useState<string[]>([]);
  const [activeTool, setActiveTool] = React.useState<FloorPlanElementType | null>(null);
  const [placementDrag, setPlacementDrag] = React.useState<PlacementDrag | null>(null);
  const [canvasMode, setCanvasMode] = React.useState<CanvasMode>("select");
  const [snapEnabled, setSnapEnabled] = React.useState(true);
  const [gridVisible, setGridVisible] = React.useState(true);
  const [zoom, setZoom] = React.useState(0.85);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [error, setError] = React.useState<string | null>(null);
  const fitToViewRef = React.useRef<(() => void) | null>(null);

  const layout = historyRef.current.present;

  const registerFitToView = React.useCallback((fn: (() => void) | null) => {
    fitToViewRef.current = fn;
  }, []);

  const fitToView = React.useCallback(() => {
    fitToViewRef.current?.();
  }, []);

  const commitLayout = React.useCallback((next: FloorPlanLayoutState, nextError: string | null = null) => {
    historyRef.current = applyLayoutChange(historyRef.current, next);
    layoutRevisionRef.current += 1;
    setError(nextError);
    bump();
  }, []);

  const select = React.useCallback((ids: string[], additive = false) => {
    setSelection((prev) => {
      if (!additive) return ids;
      const merged = new Set(prev);
      for (const id of ids) {
        if (merged.has(id)) merged.delete(id);
        else merged.add(id);
      }
      return [...merged];
    });
  }, []);

  const placeElementAt = React.useCallback(
    (type: FloorPlanElementType, worldRow: number, worldColumn: number, parentId: string | null = null) => {
      const preferredParent =
        parentId ??
        (selection.length === 1
          ? (() => {
              const selected = layout.elements.find((el) => el.id === selection[0]);
              if (selected && getElementDefinition(selected.type).supportsChildren) {
                return selected.id;
              }
              return null;
            })()
          : null);

      const target = resolvePlacementTarget(layout, type, worldRow, worldColumn, preferredParent);
      const def = getElementDefinition(type);
      const footprint = snapFootprintStrict(
        layout,
        {
          parentId: target.parentId,
          row: target.row,
          column: target.column,
          width: def.defaultWidth,
          height: def.defaultHeight,
        },
        { elementType: type },
      );
      if (!footprint) {
        setError("Cannot place here — position is invalid or occupied.");
        return false;
      }

      const element = createElement(type, {
        parentId: footprint.parentId,
        row: footprint.row,
        column: footprint.column,
        width: footprint.width,
        height: footprint.height,
        seatId: type === "seat" ? createSeatId(layout.elements) : undefined,
      });
      const result = addElement(layout, element);
      if (result.error) {
        setError(result.error);
        return false;
      }
      commitLayout(result.layout);
      setSelection([element.id]);
      setActiveTool(null);
      setPlacementDrag(null);
      return true;
    },
    [commitLayout, layout, selection],
  );

  const commitPlacementFootprint = React.useCallback(
    (type: FloorPlanElementType, footprint: Footprint) => {
      const element = createElement(type, {
        parentId: footprint.parentId,
        row: footprint.row,
        column: footprint.column,
        width: footprint.width,
        height: footprint.height,
        seatId: type === "seat" ? createSeatId(layout.elements) : undefined,
        name: type === "room" ? createRoomName(layout.elements) : undefined,
      });
      const result = addElement(layout, element);
      if (result.error) {
        setError(result.error);
        return false;
      }
      commitLayout(result.layout);
      setSelection([element.id]);
      setActiveTool(null);
      setPlacementDrag(null);
      setError(null);
      return true;
    },
    [commitLayout, layout],
  );

  const commitBulkPlacement = React.useCallback(
    (type: FloorPlanElementType, footprint: Footprint, quantity: number) => {
      const result = createBulkElements(layout, type, {
        parentId: footprint.parentId,
        startRow: footprint.row,
        startColumn: footprint.column,
        count: quantity,
      });
      if (result.error) {
        setError(result.error);
        return false;
      }
      commitLayout(result.layout);
      if (result.elementIds?.length) {
        setSelection(result.elementIds);
      }
      setActiveTool(null);
      setPlacementDrag(null);
      setError(null);
      return true;
    },
    [commitLayout, layout],
  );

  const tryMoveElement = React.useCallback(
    (elementId: string, row: number, column: number) => {
      const element = layout.elements.find((el) => el.id === elementId);
      if (!element) return false;
      const footprint = snapFootprintStrict(
        layout,
        {
          parentId: element.parentId,
          row,
          column,
          width: element.width,
          height: element.height,
        },
        { ignoreElementId: elementId, elementType: element.type },
      );
      if (!footprint) return false;
      const result = updateElement(layout, elementId, {
        row: footprint.row,
        column: footprint.column,
      });
      if (result.error) {
        setError(result.error);
        return false;
      }
      commitLayout(result.layout);
      return true;
    },
    [commitLayout, layout],
  );

  const tryResizeElement = React.useCallback(
    (elementId: string, edge: ResizeEdge, deltaRow: number, deltaCol: number) => {
      const result = resizeElement(layout, elementId, edge, deltaRow, deltaCol);
      if (result.error) {
        setError(result.error);
        return false;
      }
      commitLayout(result.layout);
      return true;
    },
    [commitLayout, layout],
  );

  const tryRotateElement = React.useCallback(
    (elementId: string, rotation: 0 | 90 | 180 | 270) => {
      const element = layout.elements.find((el) => el.id === elementId);
      if (!element || (element.rotation ?? 0) === rotation) return true;
      const result = updateElement(layout, elementId, { rotation });
      if (result.error) {
        setError(result.error);
        return false;
      }
      commitLayout(result.layout);
      setError(null);
      return true;
    },
    [commitLayout, layout],
  );

  const updateSelected = React.useCallback(
    (patch: Partial<FloorPlanElement>) => {
      if (selection.length !== 1) return;
      const result = updateElement(layout, selection[0], patch);
      if (result.error) {
        setError(result.error);
        return;
      }
      commitLayout(result.layout);
    },
    [commitLayout, layout, selection],
  );

  const deleteSelected = React.useCallback(() => {
    let next = layout;
    for (const id of selection) {
      next = deleteElement(next, id, true);
    }
    commitLayout(next);
    setSelection([]);
  }, [commitLayout, layout, selection]);

  const duplicateSelected = React.useCallback(() => {
    if (selection.length !== 1) return;
    const result = duplicateSubtree(layout, selection[0]);
    if (result.error) {
      setError(result.error);
      return;
    }
    commitLayout(result.layout);
    if (result.newRootId) setSelection([result.newRootId]);
  }, [commitLayout, layout, selection]);

  const bulkCreateSeats = React.useCallback(
    (options: BulkSeatOptions) => {
      const result = createBulkSeats(layout, options);
      if (result.error) {
        setError(result.error);
        return;
      }
      commitLayout(result.layout);
      setPlacementDrag(null);
      setError(null);
    },
    [commitLayout, layout],
  );

  const mergeSelectedSeats = React.useCallback(() => {
    const result = mergeSeats(layout, selection);
    if (result.error) {
      setError(result.error);
      return;
    }
    commitLayout(result.layout);
    if (result.groupId) setSelection([result.groupId]);
    setError(null);
  }, [commitLayout, layout, selection]);

  const mergeSeatsByDrag = React.useCallback(
    (draggedId: string, targetId: string) => {
      const result = mergeSeats(layout, [draggedId, targetId]);
      if (result.error) {
        setError(result.error);
        return false;
      }
      commitLayout(result.layout);
      if (result.groupId) setSelection([result.groupId]);
      setError(null);
      return true;
    },
    [commitLayout, layout],
  );

  const unmergeGroup = React.useCallback(
    (groupId: string) => {
      const seat = layout.elements.find((el) => el.id === groupId && el.type === "seat");
      if (seat && (seat.width > 1 || seat.height > 1)) {
        const result = splitMergedSeat(layout, groupId);
        if (result.error) {
          setError(result.error);
          return;
        }
        commitLayout(result.layout);
        setError(null);
        return;
      }
      commitLayout(unmergeSeats(layout, groupId));
    },
    [commitLayout, layout],
  );

  const resizeGrid = React.useCallback(
    (grid: FloorPlanGrid, opts?: { rowOffset?: number; columnOffset?: number }) => {
      commitLayout(resizeFloorGrid(layout, grid, opts));
    },
    [commitLayout, layout],
  );

  const undoChange = React.useCallback(() => {
    historyRef.current = undo(historyRef.current);
    setError(null);
    bump();
  }, []);

  const redoChange = React.useCallback(() => {
    historyRef.current = redo(historyRef.current);
    setError(null);
    bump();
  }, []);

  const loadLayout = React.useCallback((next: FloorPlanLayoutState) => {
    historyRef.current = createHistory(next);
    setSelection([]);
    setError(null);
    bump();
  }, []);

  const clearSelection = React.useCallback(() => setSelection([]), []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection.length) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.key === "Escape") {
        setPlacementDrag(null);
        setActiveTool(null);
        setSelection([]);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoChange();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redoChange();
      }
      if (selection.length === 1 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const el = layout.elements.find((x) => x.id === selection[0]);
        if (!el) return;
        const step = e.shiftKey ? 2 : 1;
        const patch =
          e.key === "ArrowUp"
            ? { row: el.row - step }
            : e.key === "ArrowDown"
              ? { row: el.row + step }
              : e.key === "ArrowLeft"
                ? { column: el.column - step }
                : { column: el.column + step };
        updateSelected(patch);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, layout.elements, redoChange, selection, undoChange, updateSelected]);

  const value: BuilderContextValue = {
    layout,
    selection,
    activeTool,
    placementDrag,
    canvasMode,
    snapEnabled,
    gridVisible,
    zoom,
    pan,
    error,
    canUndo: canUndo(historyRef.current),
    canRedo: canRedo(historyRef.current),
    setActiveTool,
    startPlacementDrag: setPlacementDrag,
    cancelPlacementDrag: () => setPlacementDrag(null),
    setCanvasMode,
    setSnapEnabled,
    setGridVisible,
    setZoom,
    setPan,
    select,
    clearSelection,
    commitLayout,
    placeElementAt,
    commitPlacementFootprint,
    commitBulkPlacement,
    tryMoveElement,
    tryResizeElement,
    tryRotateElement,
    updateSelected,
    deleteSelected,
    duplicateSelected,
    bulkCreateSeats,
    mergeSelectedSeats,
    mergeSeatsByDrag,
    unmergeGroup,
    resizeGrid,
    undoChange,
    redoChange,
    loadLayout,
    layoutRevision: layoutRevisionRef.current,
    registerFitToView,
    fitToView,
  };

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}
