import type { FloorPlanLayoutState } from "./types";

export type LayoutCommand =
  | { type: "set_layout"; before: FloorPlanLayoutState; after: FloorPlanLayoutState }
  | { type: "patch_layout"; patch: Partial<FloorPlanLayoutState> };

export type CommandHistory = {
  past: FloorPlanLayoutState[];
  present: FloorPlanLayoutState;
  future: FloorPlanLayoutState[];
};

const MAX_HISTORY = 80;

export function createHistory(initial: FloorPlanLayoutState): CommandHistory {
  return { past: [], present: initial, future: [] };
}

export function applyLayoutChange(
  history: CommandHistory,
  next: FloorPlanLayoutState,
): CommandHistory {
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    present: next,
    future: [],
  };
}

export function undo(history: CommandHistory): CommandHistory {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: CommandHistory): CommandHistory {
  if (!history.future.length) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}

export function canUndo(history: CommandHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: CommandHistory): boolean {
  return history.future.length > 0;
}
