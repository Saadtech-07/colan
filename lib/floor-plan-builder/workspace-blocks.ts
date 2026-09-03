import { createElementId } from "./layout-engine";
import type { FloorPlanElement, FloorPlanGrid, FloorPlanLayoutState, WorkspaceBlock } from "./types";
import { DEFAULT_FLOOR_GRID } from "./types";

export type { WorkspaceBlock };

export function createWorkspaceBlockId(): string {
  return createElementId("ws-block");
}

export function defaultWorkspaceBlockName(index: number): string {
  if (index < 26) return `Block ${String.fromCharCode(65 + index)}`;
  return `Block ${index + 1}`;
}

export function createEmptyWorkspaceBlock(index: number): WorkspaceBlock {
  return {
    id: createWorkspaceBlockId(),
    name: defaultWorkspaceBlockName(index),
    grid: { ...DEFAULT_FLOOR_GRID },
    elements: [],
  };
}

export function ensureWorkspaceBlocks(layout: FloorPlanLayoutState): WorkspaceBlock[] {
  if (layout.blocks?.length) {
    return layout.blocks.map((block) => ({
      ...block,
      grid: { ...block.grid },
      elements: block.elements.map((el) => ({ ...el })),
    }));
  }
  return [
    {
      id: createWorkspaceBlockId(),
      name: defaultWorkspaceBlockName(0),
      grid: { ...layout.grid },
      elements: layout.elements.map((el) => ({ ...el })),
    },
  ];
}

export function getAllWorkspaceElements(blocks: WorkspaceBlock[]): FloorPlanElement[] {
  return blocks.flatMap((block) => block.elements);
}

export function persistActiveWorkspaceBlock(
  blocks: WorkspaceBlock[],
  activeBlockId: string,
  grid: FloorPlanGrid,
  elements: FloorPlanElement[],
): WorkspaceBlock[] {
  return blocks.map((block) =>
    block.id === activeBlockId ? { ...block, grid: { ...grid }, elements: [...elements] } : block,
  );
}

export function applyActiveWorkspaceBlock(
  layout: FloorPlanLayoutState,
  blocks: WorkspaceBlock[],
  activeBlockId: string,
): FloorPlanLayoutState {
  const active = blocks.find((block) => block.id === activeBlockId) ?? blocks[0];
  if (!active) return layout;
  return {
    ...layout,
    blocks,
    grid: { ...active.grid },
    elements: active.elements.map((el) => ({ ...el })),
  };
}

export function normalizeWorkspaceLayout(
  layout: FloorPlanLayoutState,
  preferredActiveBlockId?: string,
): { layout: FloorPlanLayoutState; blocks: WorkspaceBlock[]; activeBlockId: string } {
  const blocks = ensureWorkspaceBlocks(layout);
  const activeBlockId =
    preferredActiveBlockId && blocks.some((block) => block.id === preferredActiveBlockId)
      ? preferredActiveBlockId
      : blocks[0]!.id;
  return {
    blocks,
    activeBlockId,
    layout: applyActiveWorkspaceBlock(layout, blocks, activeBlockId),
  };
}

export function serializeWorkspaceLayout(
  layout: FloorPlanLayoutState,
  blocks: WorkspaceBlock[],
  activeBlockId: string,
): FloorPlanLayoutState {
  const syncedBlocks = persistActiveWorkspaceBlock(
    blocks,
    activeBlockId,
    layout.grid,
    layout.elements,
  );
  const active = syncedBlocks.find((block) => block.id === activeBlockId) ?? syncedBlocks[0];
  return {
    ...layout,
    blocks: syncedBlocks,
    grid: active ? { ...active.grid } : layout.grid,
    elements: active ? [...active.elements] : layout.elements,
  };
}

/** Gap between block sheets on the builder canvas (in grid columns). */
export const WORKSPACE_BLOCK_GAP_COLUMNS = 2;

export type WorkspaceBlockCanvasLayout = {
  block: WorkspaceBlock;
  columnOffset: number;
  rowOffset: number;
};

export function getWorkspaceBlockCanvasLayouts(blocks: WorkspaceBlock[]): WorkspaceBlockCanvasLayout[] {
  let columnOffset = 0;
  return blocks.map((block) => {
    const layout = { block, columnOffset, rowOffset: 0 };
    columnOffset += block.grid.columns + WORKSPACE_BLOCK_GAP_COLUMNS;
    return layout;
  });
}

export function getWorkspaceCanvasGridSize(blocks: WorkspaceBlock[]): FloorPlanGrid {
  if (!blocks.length) return { ...DEFAULT_FLOOR_GRID };
  const layouts = getWorkspaceBlockCanvasLayouts(blocks);
  const last = layouts[layouts.length - 1]!;
  return {
    columns: last.columnOffset + last.block.grid.columns,
    rows: Math.max(...blocks.map((block) => block.grid.rows)),
  };
}

export function resolveBlockAtCanvasCell(
  blocks: WorkspaceBlock[],
  worldColumn: number,
  worldRow = 0,
): { blockId: string; localColumn: number; localRow: number } | null {
  for (const { block, columnOffset, rowOffset } of getWorkspaceBlockCanvasLayouts(blocks)) {
    const localColumn = worldColumn - columnOffset;
    if (localColumn >= 0 && localColumn < block.grid.columns) {
      return {
        blockId: block.id,
        localColumn,
        localRow: worldRow - rowOffset,
      };
    }
  }
  return null;
}

export function findBlockIdForElement(blocks: WorkspaceBlock[], elementId: string): string | null {
  for (const block of blocks) {
    if (block.elements.some((el) => el.id === elementId)) return block.id;
  }
  return null;
}
