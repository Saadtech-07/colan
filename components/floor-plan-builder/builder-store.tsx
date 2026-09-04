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
  createBulkFreeformSeats,
  createBulkSeats,
  createBulkElements,
  createElement,
  createEmptyLayout,
  createRoomName,
  createSeatId,
  deleteElement,
  duplicateEntireLayoutAt,
  duplicateSubtree,
  extractSubtrees,
  getSeatDisplayName,
  getSelectionRoots,
  insertClonedSubtrees,
  mergeSeats,
  moveFreeformElement,
  resizeElement,
  resizeFloorGrid,
  resizeFreeformElement,
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
  WorkspaceBlock,
} from "@/lib/floor-plan-builder/types";
import {
  createFreeformSeatProperties,
  DEFAULT_SEAT_HEIGHT,
  DEFAULT_SEAT_WIDTH,
  getFreeformRect,
  isFreeformSeat,
} from "@/lib/floor-plan-builder/freeform-geometry";
import {
  applyActiveWorkspaceBlock,
  createEmptyWorkspaceBlock,
  ensureWorkspaceBlocks,
  getAllWorkspaceElements,
  normalizeWorkspaceLayout,
  persistActiveWorkspaceBlock,
  serializeWorkspaceLayout,
} from "@/lib/floor-plan-builder/workspace-blocks";

export type CanvasMode = "select" | "pan";
export type PlacementDrag =
  | { mode: "element"; type: FloorPlanElementType; quantity: number }
  | { mode: "layout-clone" };

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
  commitFreeformSeatAt: (
    localX: number,
    localY: number,
    parentId?: string | null,
  ) => boolean;
  commitBulkFreeformSeatsAt: (
    localX: number,
    localY: number,
    count: number,
    parentId?: string | null,
  ) => boolean;
  commitBulkPlacement: (
    type: FloorPlanElementType,
    footprint: Footprint,
    quantity: number,
  ) => boolean;
  commitLayoutCloneAt: (worldRow: number, worldColumn: number) => boolean;
  tryMoveElement: (elementId: string, row: number, column: number) => boolean;
  tryMoveFreeformElement: (elementId: string, x: number, y: number) => boolean;
  tryResizeElement: (
    elementId: string,
    edge: ResizeEdge,
    deltaRow: number,
    deltaCol: number,
  ) => boolean;
  tryResizeFreeformElement: (
    elementId: string,
    edge: ResizeEdge,
    deltaX: number,
    deltaY: number,
  ) => boolean;
  tryRotateElement: (elementId: string, rotation: 0 | 90 | 180 | 270) => boolean;
  updateSelected: (patch: Partial<FloorPlanElement>) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  pasteClipboard: () => void;
  canPaste: boolean;
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
  resetToEmptyLayout: () => void;
  workspaceBlocks: WorkspaceBlock[];
  activeBlockId: string;
  activeBlockName: string;
  switchWorkspaceBlock: (blockId: string) => void;
  addWorkspaceBlock: (name?: string) => void;
  deleteWorkspaceBlock: (blockId: string) => void;
  updateActiveBlockName: (name: string) => void;
  layoutRevision: number;
  registerFitToView: (fn: (() => void) | null) => void;
  fitToView: () => void;
};

const BuilderContext = React.createContext<BuilderContextValue | null>(null);

function confirmSeatMerge(elements: FloorPlanElement[], seatIds: string[]): boolean {
  const seats = seatIds
    .map((id) => elements.find((el) => el.id === id))
    .filter((el): el is FloorPlanElement => el?.type === "seat");
  if (seats.length < 2) return false;

  const labels = seats.map((seat) => getSeatDisplayName(seat)).join(" and ");
  return window.confirm(
    `Merge ${labels} into one wider seat?\n\nOnly confirm if you intend to combine these seats. Use Undo (Ctrl+Z) to revert.`,
  );
}

export function useFloorPlanBuilder() {
  const ctx = React.useContext(BuilderContext);
  if (!ctx) throw new Error("useFloorPlanBuilder must be used within FloorPlanBuilderProvider");
  return ctx;
}

type ProviderProps = {
  initialLayout?: FloorPlanLayoutState;
  children: React.ReactNode;
};

type BuilderClipboard = {
  elements: FloorPlanElement[];
  rootIds: string[];
  sourceBlockId: string;
};

export function FloorPlanBuilderProvider({ initialLayout, children }: ProviderProps) {
  const boot = React.useMemo(
    () => normalizeWorkspaceLayout(initialLayout ?? createEmptyLayout()),
    [initialLayout],
  );
  const historyRef = React.useRef<CommandHistory>(createHistory(boot.layout));
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  const layoutRevisionRef = React.useRef(0);
  const [activeBlockId, setActiveBlockId] = React.useState(boot.activeBlockId);
  const activeBlockIdRef = React.useRef(activeBlockId);
  activeBlockIdRef.current = activeBlockId;

  const getWorkspaceElements = React.useCallback((): FloorPlanElement[] => {
    const current = historyRef.current.present;
    const blocks = persistActiveWorkspaceBlock(
      ensureWorkspaceBlocks(current),
      activeBlockIdRef.current,
      current.grid,
      current.elements,
    );
    return getAllWorkspaceElements(blocks);
  }, []);

  const layout = historyRef.current.present;
  const workspaceBlocks = ensureWorkspaceBlocks(
    serializeWorkspaceLayout(layout, ensureWorkspaceBlocks(layout), activeBlockId),
  );
  const activeBlockName =
    workspaceBlocks.find((block) => block.id === activeBlockId)?.name ??
    workspaceBlocks[0]?.name ??
    "Block A";
  const [activeTool, setActiveTool] = React.useState<FloorPlanElementType | null>(null);
  const [placementDrag, setPlacementDrag] = React.useState<PlacementDrag | null>(null);
  const [canvasMode, setCanvasMode] = React.useState<CanvasMode>("select");
  const [snapEnabled, setSnapEnabled] = React.useState(true);
  const [gridVisible, setGridVisible] = React.useState(true);
  const [zoom, setZoom] = React.useState(0.85);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [error, setError] = React.useState<string | null>(null);
  const fitToViewRef = React.useRef<(() => void) | null>(null);

  const [selection, setSelection] = React.useState<string[]>([]);
  const clipboardRef = React.useRef<BuilderClipboard | null>(null);
  const [canPaste, setCanPaste] = React.useState(false);

  const registerFitToView = React.useCallback((fn: (() => void) | null) => {
    fitToViewRef.current = fn;
  }, []);

  const fitToView = React.useCallback(() => {
    fitToViewRef.current?.();
  }, []);

  const commitLayout = React.useCallback((next: FloorPlanLayoutState, nextError: string | null = null) => {
    const serialized = serializeWorkspaceLayout(
      next,
      ensureWorkspaceBlocks(next),
      activeBlockIdRef.current,
    );
    historyRef.current = applyLayoutChange(historyRef.current, serialized);
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
        seatId: type === "seat" ? createSeatId(getWorkspaceElements()) : undefined,
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

  const commitFreeformSeatAt = React.useCallback(
    (localX: number, localY: number, parentId: string | null = null) => {
      const element = createElement("seat", {
        parentId,
        seatId: createSeatId(getWorkspaceElements()),
        properties: createFreeformSeatProperties(
          Math.max(0, localX),
          Math.max(0, localY),
          DEFAULT_SEAT_WIDTH,
          DEFAULT_SEAT_HEIGHT,
        ),
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

  const commitBulkFreeformSeatsAt = React.useCallback(
    (localX: number, localY: number, count: number, parentId: string | null = null) => {
      const result = createBulkFreeformSeats(layout, {
        parentId,
        startX: Math.max(0, localX),
        startY: Math.max(0, localY),
        count,
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

  const commitPlacementFootprint = React.useCallback(
    (type: FloorPlanElementType, footprint: Footprint) => {
      const element = createElement(type, {
        parentId: footprint.parentId,
        row: footprint.row,
        column: footprint.column,
        width: footprint.width,
        height: footprint.height,
        seatId: type === "seat" ? createSeatId(getWorkspaceElements()) : undefined,
        name: type === "room" ? createRoomName(getWorkspaceElements()) : undefined,
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

  const commitLayoutCloneAt = React.useCallback(
    (worldRow: number, worldColumn: number) => {
      const result = duplicateEntireLayoutAt(layout, worldRow, worldColumn);
      if (result.error) {
        setError(result.error);
        return false;
      }
      commitLayout(result.layout);
      if (result.newRootIds?.length) {
        setSelection(result.newRootIds);
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

      if (isFreeformSeat(element)) {
        return false;
      }

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

  const tryMoveFreeformElement = React.useCallback(
    (elementId: string, x: number, y: number) => {
      const result = moveFreeformElement(layout, elementId, x, y);
      if (result.error) {
        setError(result.error);
        return false;
      }
      commitLayout(result.layout);
      return true;
    },
    [commitLayout, layout],
  );

  const tryResizeFreeformElement = React.useCallback(
    (elementId: string, edge: ResizeEdge, deltaX: number, deltaY: number) => {
      const result = resizeFreeformElement(layout, elementId, edge, deltaX, deltaY);
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
    if (!selection.length) return;
    const rootIds = getSelectionRoots(layout.elements, selection);
    if (!rootIds.length) return;

    let next = layout;
    const newIds: string[] = [];
    for (const rootId of rootIds) {
      const result = duplicateSubtree(next, rootId);
      if (result.error) {
        setError(result.error);
        return;
      }
      next = result.layout;
      if (result.newRootId) newIds.push(result.newRootId);
    }
    commitLayout(next);
    if (newIds.length) setSelection(newIds);
  }, [commitLayout, layout, selection]);

  const copySelected = React.useCallback(() => {
    if (!selection.length) return;
    const rootIds = getSelectionRoots(layout.elements, selection);
    if (!rootIds.length) return;
    const elements = extractSubtrees(layout.elements, rootIds);
    clipboardRef.current = {
      elements,
      rootIds,
      sourceBlockId: activeBlockIdRef.current,
    };
    setCanPaste(true);
    setError(null);
  }, [layout.elements, selection]);

  const cutSelected = React.useCallback(() => {
    if (!selection.length) return;
    const rootIds = getSelectionRoots(layout.elements, selection);
    if (!rootIds.length) return;
    const elements = extractSubtrees(layout.elements, rootIds);
    clipboardRef.current = {
      elements,
      rootIds,
      sourceBlockId: activeBlockIdRef.current,
    };
    setCanPaste(true);
    let next = layout;
    for (const id of selection) {
      next = deleteElement(next, id, true);
    }
    commitLayout(next);
    setSelection([]);
    setError(null);
  }, [commitLayout, layout, selection]);

  const pasteClipboard = React.useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip?.elements.length) return;
    const result = insertClonedSubtrees(
      layout,
      clip.elements,
      clip.rootIds,
      2,
      2,
      getWorkspaceElements(),
    );
    if (result.error) {
      setError(result.error);
      return;
    }
    commitLayout(result.layout);
    if (result.newRootIds.length) setSelection(result.newRootIds);
    setError(null);
  }, [commitLayout, getWorkspaceElements, layout]);

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
    const seatIds = selection.filter((id) => {
      const el = layout.elements.find((e) => e.id === id);
      return el?.type === "seat";
    });
    if (seatIds.length < 2) return;
    if (!confirmSeatMerge(layout.elements, seatIds)) return;

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
      if (!confirmSeatMerge(layout.elements, [draggedId, targetId])) {
        return false;
      }
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
    const normalized = normalizeWorkspaceLayout(next);
    setActiveBlockId(normalized.activeBlockId);
    historyRef.current = createHistory(normalized.layout);
    setSelection([]);
    setError(null);
    bump();
  }, []);

  const switchWorkspaceBlock = React.useCallback(
    (blockId: string) => {
      if (blockId === activeBlockIdRef.current) return;
      const current = historyRef.current.present;
      const blocks = persistActiveWorkspaceBlock(
        ensureWorkspaceBlocks(current),
        activeBlockIdRef.current,
        current.grid,
        current.elements,
      );
      const target = blocks.find((block) => block.id === blockId);
      if (!target) return;
      setActiveBlockId(blockId);
      const next = applyActiveWorkspaceBlock(current, blocks, blockId);
      historyRef.current = applyLayoutChange(historyRef.current, next);
      layoutRevisionRef.current += 1;
      setSelection([]);
      setError(null);
      bump();
    },
    [],
  );

  const addWorkspaceBlock = React.useCallback((name?: string) => {
    const current = historyRef.current.present;
    const blocks = persistActiveWorkspaceBlock(
      ensureWorkspaceBlocks(current),
      activeBlockIdRef.current,
      current.grid,
      current.elements,
    );
    const newBlock = createEmptyWorkspaceBlock(blocks.length);
    if (name?.trim()) {
      newBlock.name = name.trim();
    }
    const nextBlocks = [...blocks, newBlock];
    setActiveBlockId(newBlock.id);
    const next = applyActiveWorkspaceBlock(current, nextBlocks, newBlock.id);
    historyRef.current = createHistory(next);
    layoutRevisionRef.current += 1;
    setSelection([]);
    setError(null);
    bump();
  }, []);

  const deleteWorkspaceBlock = React.useCallback((blockId: string) => {
    const current = historyRef.current.present;
    const blocks = persistActiveWorkspaceBlock(
      ensureWorkspaceBlocks(current),
      activeBlockIdRef.current,
      current.grid,
      current.elements,
    );
    if (blocks.length <= 1) {
      setError("Cannot delete the only layout in this workspace.");
      return;
    }
    const target = blocks.find((block) => block.id === blockId);
    if (!target) return;
    const confirmed = window.confirm(
      `Delete "${target.name}"? All elements on this layout will be removed.`,
    );
    if (!confirmed) return;

    const nextBlocks = blocks.filter((block) => block.id !== blockId);
    const nextActiveId =
      blockId === activeBlockIdRef.current ? nextBlocks[0]!.id : activeBlockIdRef.current;
    setActiveBlockId(nextActiveId);
    const next = applyActiveWorkspaceBlock(current, nextBlocks, nextActiveId);
    historyRef.current = createHistory(next);
    layoutRevisionRef.current += 1;
    setSelection([]);
    setError(null);
    bump();
  }, []);

  const updateActiveBlockName = React.useCallback((name: string) => {
    const current = historyRef.current.present;
    const blocks = persistActiveWorkspaceBlock(
      ensureWorkspaceBlocks(current),
      activeBlockIdRef.current,
      current.grid,
      current.elements,
    ).map((block) =>
      block.id === activeBlockIdRef.current ? { ...block, name } : block,
    );
    const next = applyActiveWorkspaceBlock(current, blocks, activeBlockIdRef.current);
    historyRef.current = applyLayoutChange(historyRef.current, next);
    layoutRevisionRef.current += 1;
    bump();
  }, []);

  const resetToEmptyLayout = React.useCallback(() => {
    const current = historyRef.current.present;
    const blocks = persistActiveWorkspaceBlock(
      ensureWorkspaceBlocks(current),
      activeBlockIdRef.current,
      current.grid,
      [],
    );
    const next = applyActiveWorkspaceBlock(current, blocks, activeBlockIdRef.current);
    historyRef.current = createHistory(next);
    setSelection([]);
    setError(null);
    bump();
  }, []);

  const clearSelection = React.useCallback(() => setSelection([]), []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        if (selection.length) {
          e.preventDefault();
          duplicateSelected();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        const ids = layout.elements.filter((el) => el.type !== "floor").map((el) => el.id);
        setSelection(ids);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (selection.length) {
          e.preventDefault();
          copySelected();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        if (selection.length) {
          e.preventDefault();
          cutSelected();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (canPaste) {
          e.preventDefault();
          pasteClipboard();
        }
      }
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
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "v") {
        setCanvasMode("select");
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "h") {
        setCanvasMode("pan");
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
        const step = e.shiftKey ? 10 : 1;
        if (isFreeformSeat(el)) {
          const rect = getFreeformRect(el);
          const patch =
            e.key === "ArrowUp"
              ? { y: rect.y - step }
              : e.key === "ArrowDown"
                ? { y: rect.y + step }
                : e.key === "ArrowLeft"
                  ? { x: rect.x - step }
                  : { x: rect.x + step };
          updateSelected({ properties: { ...el.properties, ...patch } });
          return;
        }
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
  }, [canPaste, copySelected, cutSelected, deleteSelected, duplicateSelected, layout.elements, pasteClipboard, redoChange, selection, setCanvasMode, undoChange, updateSelected]);

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
    commitFreeformSeatAt,
    commitBulkFreeformSeatsAt,
    commitBulkPlacement,
    commitLayoutCloneAt,
    tryMoveElement,
    tryMoveFreeformElement,
    tryResizeElement,
    tryResizeFreeformElement,
    tryRotateElement,
    updateSelected,
    deleteSelected,
    duplicateSelected,
    copySelected,
    cutSelected,
    pasteClipboard,
    canPaste,
    bulkCreateSeats,
    mergeSelectedSeats,
    mergeSeatsByDrag,
    unmergeGroup,
    resizeGrid,
    undoChange,
    redoChange,
    loadLayout,
    resetToEmptyLayout,
    workspaceBlocks,
    activeBlockId,
    activeBlockName,
    switchWorkspaceBlock,
    addWorkspaceBlock,
    deleteWorkspaceBlock,
    updateActiveBlockName,
    layoutRevision: layoutRevisionRef.current,
    registerFitToView,
    fitToView,
  };

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}
