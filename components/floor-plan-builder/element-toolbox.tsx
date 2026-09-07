"use client";

import * as React from "react";
import {
  Armchair,
  Briefcase,
  Columns,
  DoorOpen,
  Grid2x2,
  LayoutGrid,
  LogIn,
  Minus,
  Monitor,
  Minus as MinusIcon,
  Plus,
  SquareStack,
  Table,
} from "lucide-react";
import { getElementDefinition, toolboxElements } from "@/lib/floor-plan-builder/element-registry";
import type { FloorPlanElementType } from "@/lib/floor-plan-builder/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFloorPlanBuilder } from "./builder-store";

const ICONS: Partial<Record<FloorPlanElementType, React.ComponentType<{ className?: string }>>> = {
  block: SquareStack,
  room: DoorOpen,
  cabin: Briefcase,
  common_area: LayoutGrid,
  seat: Armchair,
  desk: Monitor,
  meeting_table: Table,
  pillar: Columns,
  wall: Minus,
  door: DoorOpen,
  entrance: LogIn,
  reception: Monitor,
  stairs: Grid2x2,
};

const TOOLBOX_ORDER: FloorPlanElementType[] = [
  "seat",
  "desk",
  "room",
  "cabin",
  "meeting_table",
  "pillar",
  "wall",
  "door",
  "reception",
  "common_area",
  "entrance",
  "block",
  "workstation",
  "stairs",
];

const DEFAULT_QUANTITY = 1;
const MAX_QUANTITY = 64;

export function ElementToolbox() {
  const { placementDrag, startPlacementDrag } = useFloorPlanBuilder();
  const [quantities, setQuantities] = React.useState<Partial<Record<FloorPlanElementType, number>>>({});
  const [activeType, setActiveType] = React.useState<FloorPlanElementType | null>(null);

  const defs = React.useMemo(() => {
    const byType = new Map(toolboxElements().map((def) => [def.type, def]));
    return TOOLBOX_ORDER.map((type) => byType.get(type) ?? getElementDefinition(type)).filter(
      (def) => def.type !== "floor",
    );
  }, []);

  const getQty = (type: FloorPlanElementType) => quantities[type] ?? DEFAULT_QUANTITY;

  const setQty = (type: FloorPlanElementType, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [type]: Math.min(MAX_QUANTITY, Math.max(DEFAULT_QUANTITY, value)),
    }));
  };

  const beginDrag = (type: FloorPlanElementType, event: React.PointerEvent) => {
    event.preventDefault();
    setActiveType(type);
    startPlacementDrag({ type, quantity: getQty(type) });
  };

  return (
    <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-border/60 bg-card p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Elements</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Set quantity with +/−, then drag onto the canvas. Items fill left-to-right, then wrap to the next row.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {defs.map((def) => {
          const Icon = ICONS[def.type] ?? LayoutGrid;
          const qty = getQty(def.type);
          const isActive = activeType === def.type || placementDrag?.type === def.type;
          return (
            <div
              key={def.type}
              className={cn(
                "rounded-xl border transition",
                isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border/70 bg-background",
              )}
            >
              <button
                type="button"
                onClick={() => setActiveType(def.type)}
                onPointerDown={(e) => beginDrag(def.type, e)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left select-none"
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: def.borderColor }} />
                <span className="flex-1 text-xs font-semibold">{def.label}</span>
                {qty > 1 ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    ×{qty}
                  </span>
                ) : null}
              </button>
              {isActive ? (
                <div className="flex items-center justify-between gap-2 border-t border-border/50 px-2 py-2">
                  <span className="text-[10px] font-medium text-muted-foreground">Quantity</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setQty(def.type, qty - 1)}
                      disabled={qty <= 1}
                    >
                      <MinusIcon className="h-3.5 w-3.5" />
                    </Button>
                    <span className="min-w-[2rem] text-center text-xs font-bold tabular-nums">{qty}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setQty(def.type, qty + 1)}
                      disabled={qty >= MAX_QUANTITY}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function getToolHint(type: FloorPlanElementType | null, quantity = 1): string {
  if (!type) return "Drag elements from the toolbox onto the canvas. Use Select or Pan in the toolbar.";
  const label = getElementDefinition(type).label;
  if (quantity > 1) return `Dragging ${quantity}× ${label} — release on a valid grid area.`;
  return `Dragging ${label} — release on a valid cell.`;
}
