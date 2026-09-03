"use client";

import * as React from "react";
import { Copy, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getElementDefinition } from "@/lib/floor-plan-builder/element-registry";
import { getParentElement } from "@/lib/floor-plan-builder/hierarchy";
import { getContainerCapacity, getSeatDisplayName, seatCountInContainer } from "@/lib/floor-plan-builder/layout-engine";
import { useFloorPlanBuilder } from "./builder-store";
import { BulkSeatDialog } from "./bulk-seat-dialog";

type Props = {
  floorName?: string;
  onFloorNameChange?: (name: string) => void;
};

function WorkspaceSettings({
  floorName,
  onFloorNameChange,
}: Required<Pick<Props, "floorName" | "onFloorNameChange">>) {
  const { activeBlockName, updateActiveBlockName } = useFloorPlanBuilder();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="floor-name" className="text-xs">
          Workspace name
        </Label>
        <Input
          id="floor-name"
          value={floorName}
          onChange={(e) => onFloorNameChange(e.target.value)}
          placeholder="e.g. Colan Layout"
          className="h-8 rounded-lg"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="layout-name" className="text-xs">
          Active layout name
        </Label>
        <Input
          id="layout-name"
          value={activeBlockName}
          onChange={(e) => updateActiveBlockName(e.target.value)}
          placeholder="Block A"
          className="h-8 rounded-lg"
        />
      </div>
    </div>
  );
}

export function PropertiesPanel({ floorName = "", onFloorNameChange }: Props) {
  const {
    layout,
    selection,
    updateSelected,
    deleteSelected,
    duplicateSelected,
    mergeSelectedSeats,
    unmergeGroup,
  } = useFloorPlanBuilder();

  const [bulkOpen, setBulkOpen] = React.useState(false);
  const selected =
    selection.length === 1 ? layout.elements.find((el) => el.id === selection[0]) ?? null : null;
  const selectedMany = selection.length > 1;

  const panelClass =
    "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4";

  if (!selected && !selectedMany) {
    return (
      <aside className={panelClass}>
        <p className="text-sm font-semibold">Properties</p>
        {onFloorNameChange ? (
          <WorkspaceSettings floorName={floorName} onFloorNameChange={onFloorNameChange} />
        ) : null}
        <GridSizeControls />
        <ClearCanvasButton />
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setBulkOpen(true)}>
          Bulk create seats
        </Button>
        <BulkSeatDialog open={bulkOpen} onOpenChange={setBulkOpen} />
      </aside>
    );
  }

  if (selectedMany) {
    const seats = layout.elements.filter((el) => selection.includes(el.id) && el.type === "seat");
    return (
      <aside className={panelClass}>
        {onFloorNameChange ? (
          <WorkspaceSettings floorName={floorName} onFloorNameChange={onFloorNameChange} />
        ) : null}
        <p className="text-sm font-semibold">{selection.length} selected</p>
        <p className="text-[11px] text-muted-foreground">
          Ctrl+click or Shift+click to add seats. Drag one seat onto another to merge.
        </p>
        {seats.length >= 2 ? (
          <Button type="button" className="rounded-xl gap-2" onClick={mergeSelectedSeats}>
            <Users className="h-4 w-4" />
            Merge seats
          </Button>
        ) : null}
        <Button type="button" variant="destructive" className="rounded-xl gap-2" onClick={deleteSelected}>
          <Trash2 className="h-4 w-4" />
          Delete selected
        </Button>
      </aside>
    );
  }

  if (!selected) return null;

  const def = getElementDefinition(selected.type);
  const parent = getParentElement(layout.elements, selected.parentId);
  const capacity = getContainerCapacity(selected);
  const seatCount = capacity !== null ? seatCountInContainer(layout.elements, selected.id) : null;

  const setCapacity = (value: number) => {
    updateSelected({
      properties: { ...selected.properties, capacity: Math.max(0, value) },
    });
  };

  return (
    <aside className={panelClass}>
      {onFloorNameChange ? (
        <WorkspaceSettings floorName={floorName} onFloorNameChange={onFloorNameChange} />
      ) : null}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Properties</p>
        <p className="mt-1 text-sm font-bold">
          {selected.type === "seat" ? getSeatDisplayName(selected) : selected.name}
        </p>
        <p className="text-xs text-muted-foreground">{def.label}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prop-name">Name</Label>
        <Input
          id="prop-name"
          value={selected.type === "seat" ? getSeatDisplayName(selected) : selected.name}
          onChange={(e) => updateSelected({ name: e.target.value })}
          className="rounded-xl"
        />
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Parent: <span className="font-medium text-foreground">{parent?.name ?? "Floor"}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="prop-row">Row</Label>
          <Input
            id="prop-row"
            type="number"
            min={0}
            value={selected.row}
            onChange={(e) => updateSelected({ row: Number(e.target.value) || 0 })}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prop-col">Column</Label>
          <Input
            id="prop-col"
            type="number"
            min={0}
            value={selected.column}
            onChange={(e) => updateSelected({ column: Number(e.target.value) || 0 })}
            className="rounded-xl"
          />
        </div>
        {def.supportsResize ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="prop-h">Rows</Label>
              <Input
                id="prop-h"
                type="number"
                min={def.minHeight}
                value={selected.height}
                onChange={(e) => updateSelected({ height: Number(e.target.value) || def.minHeight })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-w">Columns</Label>
              <Input
                id="prop-w"
                type="number"
                min={def.minWidth}
                value={selected.width}
                onChange={(e) => updateSelected({ width: Number(e.target.value) || def.minWidth })}
                className="rounded-xl"
              />
            </div>
          </>
        ) : null}
      </div>

      {def.supportsCapacity ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <Label htmlFor="prop-capacity">Capacity</Label>
          <Input
            id="prop-capacity"
            type="number"
            min={0}
            value={capacity ?? 0}
            onChange={(e) => setCapacity(Number(e.target.value) || 0)}
            className="rounded-xl"
          />
          {seatCount !== null && capacity !== null ? (
            <p className="text-xs text-muted-foreground">
              Occupancy: {seatCount} / {capacity}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Rotation</Label>
        <Select
          value={String(selected.rotation ?? 0)}
          onValueChange={(value) =>
            updateSelected({ rotation: Number(value) as 0 | 90 | 180 | 270 })
          }
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 90, 180, 270].map((deg) => (
              <SelectItem key={deg} value={String(deg)}>
                {deg === 0 ? "0° (default)" : deg === 180 ? "180° (flipped)" : `${deg}°`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Use 90° or 270° to turn vertical elements horizontal (e.g. entrance, wall).
        </p>
      </div>

      {selected.type === "seat" && (selected.width > 1 || selected.height > 1) ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => unmergeGroup(selected.id)}
        >
          Split merged seat
        </Button>
      ) : null}

      {def.supportsChildren ? (
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setBulkOpen(true)}>
          Add seats inside
        </Button>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 rounded-xl gap-2" onClick={duplicateSelected}>
          <Copy className="h-4 w-4" />
          Duplicate
        </Button>
        <Button type="button" variant="destructive" className="flex-1 rounded-xl gap-2" onClick={deleteSelected}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <BulkSeatDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        parentId={def.supportsChildren ? selected.id : selected.parentId}
      />
    </aside>
  );
}

function ClearCanvasButton() {
  const { layout, resetToEmptyLayout } = useFloorPlanBuilder();
  if (layout.elements.length === 0) return null;

  return (
    <Button
      type="button"
      variant="outline"
      className="rounded-xl"
      onClick={() => {
        const confirmed = window.confirm(
          "Clear the active layout? All seats, rooms, and structures on this layout will be removed.",
        );
        if (confirmed) resetToEmptyLayout();
      }}
    >
      Clear canvas
    </Button>
  );
}

function GridSizeControls() {
  const { layout, resizeGrid } = useFloorPlanBuilder();
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Floor grid size</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Rows</Label>
          <Input
            type="number"
            min={4}
            value={layout.grid.rows}
            onChange={(e) =>
              resizeGrid({ ...layout.grid, rows: Math.max(4, Number(e.target.value) || layout.grid.rows) })
            }
            className="h-9 rounded-lg"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Columns</Label>
          <Input
            type="number"
            min={4}
            value={layout.grid.columns}
            onChange={(e) =>
              resizeGrid({
                ...layout.grid,
                columns: Math.max(4, Number(e.target.value) || layout.grid.columns),
              })
            }
            className="h-9 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
