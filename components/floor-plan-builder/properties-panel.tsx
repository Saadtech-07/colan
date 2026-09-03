"use client";

import * as React from "react";
import { Copy, Grid3x3, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { InspectorField, InspectorSection } from "./builder-ui";

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
    <InspectorSection title="Floor information">
      <div className="space-y-3">
        <InspectorField label="Workspace name" htmlFor="floor-name">
          <Input
            id="floor-name"
            value={floorName}
            onChange={(e) => onFloorNameChange(e.target.value)}
            placeholder="e.g. Colan Layout"
            className="h-8 rounded-lg border-border/50 bg-background text-sm"
          />
        </InspectorField>
        <InspectorField label="Active layout name" htmlFor="layout-name">
          <Input
            id="layout-name"
            value={activeBlockName}
            onChange={(e) => updateActiveBlockName(e.target.value)}
            placeholder="Block A"
            className="h-8 rounded-lg border-border/50 bg-background text-sm"
          />
        </InspectorField>
      </div>
    </InspectorSection>
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
    "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4";

  if (!selected && !selectedMany) {
    return (
      <aside className={panelClass}>
        <div className="border-b border-border/50 pb-4">
          <p className="text-sm font-semibold tracking-tight text-foreground">Inspector</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Floor and canvas settings</p>
        </div>
        {onFloorNameChange ? (
          <WorkspaceSettings floorName={floorName} onFloorNameChange={onFloorNameChange} />
        ) : null}
        <GridSizeControls />
        <InspectorSection title="Canvas actions">
          <div className="flex flex-col gap-2">
            <ClearCanvasButton />
            <Button
              type="button"
              variant="outline"
              className="h-9 justify-start gap-2 rounded-lg border-border/50 text-sm font-medium"
              onClick={() => setBulkOpen(true)}
            >
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
              Bulk create seats
            </Button>
          </div>
        </InspectorSection>
        <BulkSeatDialog open={bulkOpen} onOpenChange={setBulkOpen} />
      </aside>
    );
  }

  if (selectedMany) {
    const seats = layout.elements.filter((el) => selection.includes(el.id) && el.type === "seat");
    return (
      <aside className={panelClass}>
        <div className="border-b border-border/50 pb-4">
          <p className="text-sm font-semibold tracking-tight text-foreground">Inspector</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{selection.length} elements selected</p>
        </div>
        {onFloorNameChange ? (
          <WorkspaceSettings floorName={floorName} onFloorNameChange={onFloorNameChange} />
        ) : null}
        <InspectorSection
          title="Selection"
          description="Ctrl+click or Shift+click to add seats. Drag one seat onto another to merge."
        >
          <div className="flex flex-col gap-2">
            {seats.length >= 2 ? (
              <Button type="button" className="h-9 justify-start gap-2 rounded-lg text-sm" onClick={mergeSelectedSeats}>
                <Users className="h-4 w-4" />
                Merge seats
              </Button>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              className="h-9 justify-start gap-2 rounded-lg text-sm"
              onClick={deleteSelected}
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </Button>
          </div>
        </InspectorSection>
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

  const displayName = selected.type === "seat" ? getSeatDisplayName(selected) : selected.name;

  return (
    <aside className={panelClass}>
      <div className="border-b border-border/50 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {def.label}
        </p>
        <p className="mt-1 text-base font-semibold tracking-tight text-foreground">{displayName}</p>
      </div>

      <InspectorSection title="Identity">
        <InspectorField label="Name" htmlFor="prop-name">
          <Input
            id="prop-name"
            value={displayName}
            onChange={(e) => updateSelected({ name: e.target.value })}
            className="h-8 rounded-lg border-border/50 bg-background text-sm"
          />
        </InspectorField>
        <p className="text-[11px] text-muted-foreground">
          Parent: <span className="font-medium text-foreground">{parent?.name ?? "Floor"}</span>
        </p>
      </InspectorSection>

      <InspectorSection title="Position">
        <div className="grid grid-cols-2 gap-3">
          <InspectorField label="Row" htmlFor="prop-row">
            <Input
              id="prop-row"
              type="number"
              min={0}
              value={selected.row}
              onChange={(e) => updateSelected({ row: Number(e.target.value) || 0 })}
              className="h-8 rounded-lg border-border/50 bg-background text-sm tabular-nums"
            />
          </InspectorField>
          <InspectorField label="Column" htmlFor="prop-col">
            <Input
              id="prop-col"
              type="number"
              min={0}
              value={selected.column}
              onChange={(e) => updateSelected({ column: Number(e.target.value) || 0 })}
              className="h-8 rounded-lg border-border/50 bg-background text-sm tabular-nums"
            />
          </InspectorField>
        </div>
      </InspectorSection>

      {def.supportsResize ? (
        <InspectorSection title="Size">
          <div className="grid grid-cols-2 gap-3">
            <InspectorField label="Rows" htmlFor="prop-h">
              <Input
                id="prop-h"
                type="number"
                min={def.minHeight}
                value={selected.height}
                onChange={(e) => updateSelected({ height: Number(e.target.value) || def.minHeight })}
                className="h-8 rounded-lg border-border/50 bg-background text-sm tabular-nums"
              />
            </InspectorField>
            <InspectorField label="Columns" htmlFor="prop-w">
              <Input
                id="prop-w"
                type="number"
                min={def.minWidth}
                value={selected.width}
                onChange={(e) => updateSelected({ width: Number(e.target.value) || def.minWidth })}
                className="h-8 rounded-lg border-border/50 bg-background text-sm tabular-nums"
              />
            </InspectorField>
          </div>
        </InspectorSection>
      ) : null}

      {def.supportsCapacity ? (
        <InspectorSection title="Capacity">
          <InspectorField label="Max seats" htmlFor="prop-capacity">
            <Input
              id="prop-capacity"
              type="number"
              min={0}
              value={capacity ?? 0}
              onChange={(e) => setCapacity(Number(e.target.value) || 0)}
              className="h-8 rounded-lg border-border/50 bg-background text-sm tabular-nums"
            />
          </InspectorField>
          {seatCount !== null && capacity !== null ? (
            <p className="text-[11px] text-muted-foreground">
              Occupancy: <span className="font-medium text-foreground">{seatCount}</span> / {capacity}
            </p>
          ) : null}
        </InspectorSection>
      ) : null}

      <InspectorSection title="Rotation">
        <Select
          value={String(selected.rotation ?? 0)}
          onValueChange={(value) =>
            updateSelected({ rotation: Number(value) as 0 | 90 | 180 | 270 })
          }
        >
          <SelectTrigger className="h-8 rounded-lg border-border/50 bg-background text-sm">
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
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Use 90° or 270° to turn vertical elements horizontal (e.g. entrance, wall).
        </p>
      </InspectorSection>

      <InspectorSection title="Actions">
        <div className="flex flex-col gap-2">
          {selected.type === "seat" && (selected.width > 1 || selected.height > 1) ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-border/50 text-sm"
              onClick={() => unmergeGroup(selected.id)}
            >
              Split merged seat
            </Button>
          ) : null}
          {def.supportsChildren ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-border/50 text-sm"
              onClick={() => setBulkOpen(true)}
            >
              Add seats inside
            </Button>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 flex-1 gap-2 rounded-lg border-border/50 text-sm"
              onClick={duplicateSelected}
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9 flex-1 gap-2 rounded-lg text-sm"
              onClick={deleteSelected}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </InspectorSection>

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
      className="h-9 justify-start rounded-lg border-border/50 text-sm font-medium text-muted-foreground"
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
    <InspectorSection title="Grid size">
      <div className="grid grid-cols-2 gap-3">
        <InspectorField label="Rows">
          <Input
            type="number"
            min={4}
            value={layout.grid.rows}
            onChange={(e) =>
              resizeGrid({ ...layout.grid, rows: Math.max(4, Number(e.target.value) || layout.grid.rows) })
            }
            className="h-8 rounded-lg border-border/50 bg-background text-sm tabular-nums"
          />
        </InspectorField>
        <InspectorField label="Columns">
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
            className="h-8 rounded-lg border-border/50 bg-background text-sm tabular-nums"
          />
        </InspectorField>
      </div>
    </InspectorSection>
  );
}
