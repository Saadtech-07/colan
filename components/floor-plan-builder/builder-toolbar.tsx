"use client";

import {
  Eye,
  Grid3x3,
  Hand,
  Magnet,
  Maximize2,
  MousePointer2,
  Redo2,
  RotateCcw,
  Save,
  SplitSquareHorizontal,
  Trash2,
  Undo2,
  Upload,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isMergedSeat } from "@/lib/floor-plan-builder/freeform-geometry";
import { ToolbarGroup, ToolIconButton } from "./builder-ui";
import { useFloorPlanBuilder } from "./builder-store";

type Props = {
  onSaveDraft: () => void;
  onPublish: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
  onClearCanvas?: () => void;
  saving?: boolean;
  autoSaving?: boolean;
  publishing?: boolean;
  deleting?: boolean;
  canDelete?: boolean;
};

export function BuilderToolbar({
  onSaveDraft,
  onPublish,
  onDelete,
  onPreview,
  onClearCanvas,
  saving,
  autoSaving,
  publishing,
  deleting,
  canDelete,
}: Props) {
  const {
    zoom,
    setZoom,
    snapEnabled,
    setSnapEnabled,
    gridVisible,
    setGridVisible,
    canvasMode,
    setCanvasMode,
    canUndo,
    canRedo,
    undoChange,
    redoChange,
    fitToView,
    layout,
    selection,
    mergeSelectedSeats,
    unmergeGroup,
  } = useFloorPlanBuilder();

  const selectedSeats = selection
    .map((id) => layout.elements.find((el) => el.id === id))
    .filter((el): el is NonNullable<typeof el> => el?.type === "seat");
  const canMergeSeats = selectedSeats.length >= 2;
  const mergedSeatSelected =
    selection.length === 1 &&
    selectedSeats.length === 1 &&
    isMergedSeat(selectedSeats[0]!);

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      <ToolbarGroup label="History">
        <ToolIconButton icon={Undo2} title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undoChange} />
        <ToolIconButton icon={Redo2} title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redoChange} />
      </ToolbarGroup>

      <ToolbarGroup label="Canvas">
        <ToolIconButton
          icon={Grid3x3}
          title="Toggle grid"
          active={gridVisible}
          onClick={() => setGridVisible(!gridVisible)}
        />
        <ToolIconButton
          icon={Magnet}
          title="Snap to grid"
          active={snapEnabled}
          onClick={() => setSnapEnabled(!snapEnabled)}
        />
        <ToolIconButton
          icon={MousePointer2}
          title="Select (V)"
          active={canvasMode === "select"}
          onClick={() => setCanvasMode("select")}
        />
        <ToolIconButton
          icon={Hand}
          title="Pan (H)"
          active={canvasMode === "pan"}
          onClick={() => setCanvasMode("pan")}
        />
      </ToolbarGroup>

      <ToolbarGroup label="Seats">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 rounded-md px-2 text-xs font-medium"
          disabled={!canMergeSeats}
          onClick={() => void mergeSelectedSeats()}
          title="Merge selected seats (Ctrl+click to multi-select)"
        >
          <Users className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Merge</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 rounded-md px-2 text-xs font-medium"
          disabled={!mergedSeatSelected}
          onClick={() => {
            const seat = selectedSeats[0];
            if (seat) unmergeGroup(seat.id);
          }}
          title="Split merged seat back into individual seats"
        >
          <SplitSquareHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Unmerge</span>
        </Button>
      </ToolbarGroup>

      <ToolbarGroup label="View">
        <ToolIconButton
          icon={ZoomOut}
          title="Zoom out"
          onClick={() => setZoom(Math.max(0.35, zoom - 0.1))}
          size="sm"
        />
        <span className="min-w-[2.85rem] px-0.5 text-center text-[11px] font-semibold tabular-nums text-foreground/70">
          {Math.round(zoom * 100)}%
        </span>
        <ToolIconButton
          icon={ZoomIn}
          title="Zoom in"
          onClick={() => setZoom(Math.min(2, zoom + 0.1))}
          size="sm"
        />
        <ToolIconButton icon={Maximize2} title="Fit to view" onClick={fitToView} size="sm" />
        <ToolIconButton
          icon={RotateCcw}
          title="Reset zoom (100%)"
          onClick={() => {
            setZoom(1);
            fitToView();
          }}
          size="sm"
        />
        {onPreview ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-md px-2 text-xs font-medium"
            onClick={onPreview}
            title="Preview floor plan"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
        ) : null}
      </ToolbarGroup>

      <ToolbarGroup label="Document">
        {onClearCanvas && layout.elements.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground"
            onClick={onClearCanvas}
            title="Clear active layout"
          >
            Clear
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 rounded-md px-2.5 text-xs font-medium",
            (saving || autoSaving) && "text-muted-foreground",
          )}
          disabled={saving || autoSaving}
          onClick={onSaveDraft}
          title="Save draft"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : autoSaving ? "Auto-saving…" : "Save"}
        </Button>
        {canDelete && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-md px-2 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={deleting}
            onClick={onDelete}
            title="Delete floor plan"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "…" : "Delete"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="h-7 gap-1.5 rounded-md px-3 text-xs font-semibold shadow-sm"
          disabled={publishing}
          onClick={onPublish}
          title="Publish floor plan"
        >
          <Upload className="h-3.5 w-3.5" />
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      </ToolbarGroup>
    </div>
  );
}
