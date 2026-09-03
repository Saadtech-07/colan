"use client";

import {
  Grid3x3,
  Hand,
  Magnet,
  MousePointer2,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
  Eye,
  Maximize2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px shrink-0 bg-border/80" aria-hidden />;
}

function ToolButton({
  icon: Icon,
  title,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/25"
          : "border-transparent bg-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60 hover:text-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={active ? 2.25 : 2} />
    </button>
  );
}

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
  } = useFloorPlanBuilder();

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
      <ToolButton icon={Undo2} title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undoChange} />
      <ToolButton icon={Redo2} title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redoChange} />

      <ToolbarDivider />

      <ToolButton
        icon={Grid3x3}
        title="Toggle grid"
        active={gridVisible}
        onClick={() => setGridVisible(!gridVisible)}
      />
      <ToolButton
        icon={Magnet}
        title="Snap to grid"
        active={snapEnabled}
        onClick={() => setSnapEnabled(!snapEnabled)}
      />

      <ToolbarDivider />

      <ToolButton
        icon={MousePointer2}
        title="Select (V)"
        active={canvasMode === "select"}
        onClick={() => setCanvasMode("select")}
      />
      <ToolButton
        icon={Hand}
        title="Pan (H)"
        active={canvasMode === "pan"}
        onClick={() => setCanvasMode("pan")}
      />

      <ToolbarDivider />

      <ToolButton
        icon={ZoomOut}
        title="Zoom out"
        onClick={() => setZoom(Math.max(0.35, zoom - 0.1))}
      />
      <span className="min-w-[2.75rem] text-center text-[11px] font-semibold tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <ToolButton
        icon={ZoomIn}
        title="Zoom in"
        onClick={() => setZoom(Math.min(2, zoom + 0.1))}
      />
      <ToolButton icon={Maximize2} title="Fit to view" onClick={fitToView} />

      <ToolbarDivider />

      {onClearCanvas && layout.elements.length > 0 ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-md px-2.5 text-xs"
            onClick={onClearCanvas}
          >
            Clear
          </Button>
          <ToolbarDivider />
        </>
      ) : null}

      {onPreview ? (
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-md px-2.5 text-xs" onClick={onPreview}>
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 rounded-md px-2.5 text-xs"
        disabled={saving || autoSaving}
        onClick={onSaveDraft}
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving…" : autoSaving ? "Auto-saving…" : "Save"}
      </Button>
      {canDelete && onDelete ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md px-2.5 text-xs text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleting ? "…" : "Delete"}
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1.5 rounded-md px-3 text-xs"
        disabled={publishing}
        onClick={onPublish}
      >
        <Upload className="h-3.5 w-3.5" />
        {publishing ? "Publishing…" : "Publish"}
      </Button>
    </div>
  );
}
