"use client";

import * as React from "react";
import {
  Armchair,
  Bell,
  Briefcase,
  Columns3,
  Grid2x2,
  LayoutGrid,
  LogIn,
  Minus,
  Plus,
  RectangleHorizontal,
  Square,
  SquareStack,
} from "lucide-react";
import { getElementDefinition } from "@/lib/floor-plan-builder/element-registry";
import type { FloorPlanElementType } from "@/lib/floor-plan-builder/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlacementDrag } from "./builder-store";
import { useFloorPlanBuilder } from "./builder-store";
import { ArrowLeft } from "lucide-react";

const ICONS: Partial<Record<FloorPlanElementType, React.ComponentType<{ className?: string }>>> = {
  seat: Armchair,
  room: Square,
  cabin: Briefcase,
  common_area: LayoutGrid,
  pillar: Columns3,
  wall: RectangleHorizontal,
  entrance: LogIn,
  reception: Bell,
  block: SquareStack,
  stairs: Grid2x2,
};

const TOOLBOX_ORDER: FloorPlanElementType[] = [
  "seat",
  "room",
  "cabin",
  "pillar",
  "wall",
  "reception",
  "common_area",
  "entrance",
  "block",
  "stairs",
];

const SHORT_LABELS: Partial<Record<FloorPlanElementType, string>> = {
  common_area: "Common",
  entrance: "Entrance",
  reception: "Reception",
};

const DEFAULT_QUANTITY = 1;
const MAX_QUANTITY = 64;

type ElementToolboxProps = {
  onBack?: () => void;
};

export function ElementToolbox({ onBack }: ElementToolboxProps) {
  const { startPlacementDrag } = useFloorPlanBuilder();
  const [quantities, setQuantities] = React.useState<Partial<Record<FloorPlanElementType, number>>>({});
  const [activeType, setActiveType] = React.useState<FloorPlanElementType>("seat");

  const defs = React.useMemo(() => {
    return TOOLBOX_ORDER.map((type) => getElementDefinition(type));
  }, []);

  const getQty = (type: FloorPlanElementType) => quantities[type] ?? DEFAULT_QUANTITY;

  const setQty = (type: FloorPlanElementType, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [type]: Math.min(MAX_QUANTITY, Math.max(DEFAULT_QUANTITY, value)),
    }));
  };

  const activeQty = getQty(activeType);
  const activeLabel = SHORT_LABELS[activeType] ?? getElementDefinition(activeType).label;

  const beginDrag = (type: FloorPlanElementType, event: React.PointerEvent) => {
    event.preventDefault();
    setActiveType(type);
    startPlacementDrag({ mode: "element", type, quantity: getQty(type) });
  };

  return (
    <aside className="flex h-full min-h-0 w-[88px] shrink-0 flex-col border-r border-border/60 bg-card">
      {onBack ? (
        <div className="shrink-0 border-b border-border/60 p-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full flex-col gap-0.5 rounded-lg px-1 py-1.5 text-[9px] font-semibold"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back
          </Button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
        {defs.map((def) => {
          const Icon = ICONS[def.type] ?? LayoutGrid;
          const qty = getQty(def.type);
          const isActive = activeType === def.type;
          const label = SHORT_LABELS[def.type] ?? def.label;

          return (
            <button
              key={def.type}
              type="button"
              onClick={() => setActiveType(def.type)}
              onPointerDown={(e) => beginDrag(def.type, e)}
              title={def.label}
              className={cn(
                "relative flex w-full flex-col items-center gap-0.5 rounded-lg border px-1 py-2 transition select-none",
                isActive
                  ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/25"
                  : "border-transparent bg-background hover:border-border/60 hover:bg-muted/40",
              )}
            >
              <Icon
                className="h-[18px] w-[18px] shrink-0"
                style={{ color: def.borderColor }}
                strokeWidth={2}
              />
              <span className="max-w-full truncate text-center text-[9px] font-semibold leading-tight text-foreground/85">
                {label}
              </span>
              {qty > 1 ? (
                <span className="absolute right-1 top-1 rounded bg-primary px-1 text-[8px] font-bold leading-none text-primary-foreground">
                  {qty}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-border/60 bg-muted/25 p-2">
        <p className="mb-1.5 truncate text-center text-[9px] font-medium text-muted-foreground">
          {activeLabel}
        </p>
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-md"
            onClick={() => setQty(activeType, activeQty - 1)}
            disabled={activeQty <= 1}
            aria-label="Decrease quantity"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="min-w-[1.5rem] text-center text-xs font-bold tabular-nums">{activeQty}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-md"
            onClick={() => setQty(activeType, activeQty + 1)}
            disabled={activeQty >= MAX_QUANTITY}
            aria-label="Increase quantity"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export function getToolHint(placementDrag: PlacementDrag | null): string {
  if (!placementDrag) {
    return "Scroll to pan · Ctrl+scroll zoom · Ctrl+click multi-select · Ctrl+C/V/X copy, cut, paste";
  }
  if (placementDrag.mode === "layout-clone") {
    return "Drag to place a full copy of this layout. Release on an open area.";
  }
  const label = getElementDefinition(placementDrag.type).label;
  if (placementDrag.quantity > 1) {
    return `Dragging ${placementDrag.quantity}× ${label} — release on a valid grid area.`;
  }
  return `Dragging ${label} — release on a valid cell.`;
}
