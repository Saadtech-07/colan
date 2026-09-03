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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFloorPlanBuilder } from "./builder-store";

type Props = {
  floorName: string;
  onFloorNameChange?: (name: string) => void;
  onBack?: () => void;
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
  floorName,
  onFloorNameChange,
  onBack,
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
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 bg-card px-3 py-2">
      {onBack ? (
        <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={onBack}>
          Back
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        {onFloorNameChange ? (
          <Input
            value={floorName}
            onChange={(e) => onFloorNameChange(e.target.value)}
            placeholder="Floor name (e.g. Hyderabad · Block A)"
            className="h-9 max-w-md rounded-xl border-border/70 bg-background text-sm font-semibold"
            aria-label="Floor name"
          />
        ) : (
          <p className="truncate text-sm font-semibold text-foreground">{floorName}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">Floor Plan Builder</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={!canUndo} onClick={undoChange}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={!canRedo} onClick={redoChange}>
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={gridVisible ? "secondary" : "outline"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => setGridVisible(!gridVisible)}
        >
          <Grid3x3 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={snapEnabled ? "secondary" : "outline"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => setSnapEnabled(!snapEnabled)}
        >
          <Magnet className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={canvasMode === "select" ? "secondary" : "outline"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => setCanvasMode("select")}
          title="Select"
        >
          <MousePointer2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={canvasMode === "pan" ? "secondary" : "outline"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => setCanvasMode("pan")}
          title="Pan"
        >
          <Hand className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setZoom(Math.max(0.35, zoom - 0.1))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="min-w-[3rem] text-center text-xs font-medium text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl"
          title="Fit floor to view"
          onClick={fitToView}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        {onClearCanvas && layout.elements.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={onClearCanvas}
          >
            Clear canvas
          </Button>
        ) : null}
        {onPreview ? (
          <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={onPreview}>
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" disabled={saving || autoSaving} onClick={onSaveDraft}>
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : autoSaving ? "Auto-saving…" : "Save Draft"}
        </Button>
        {canDelete && onDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        ) : null}
        <Button type="button" size="sm" className="rounded-xl gap-1.5" disabled={publishing} onClick={onPublish}>
          <Upload className="h-4 w-4" />
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </header>
  );
}
