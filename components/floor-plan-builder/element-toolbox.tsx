"use client";

import * as React from "react";
import {
  Armchair,
  ArrowLeft,
  Bell,
  Briefcase,
  Columns3,
  GripVertical,
  Grid2x2,
  LayoutGrid,
  LogIn,
  Minus,
  Plus,
  RectangleHorizontal,
  Search,
  Square,
  SquareStack,
} from "lucide-react";
import { getElementDefinition } from "@/lib/floor-plan-builder/element-registry";
import type { FloorPlanElementType } from "@/lib/floor-plan-builder/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlacementDrag } from "./builder-store";
import { useFloorPlanBuilder } from "./builder-store";

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

const TOOLBOX_CATEGORIES: { label: string; types: FloorPlanElementType[] }[] = [
  { label: "Workspace", types: ["seat"] },
  { label: "Structure", types: ["room", "cabin", "block", "common_area", "reception"] },
  { label: "Infrastructure", types: ["pillar", "wall", "entrance", "stairs"] },
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
  const [search, setSearch] = React.useState("");

  const getQty = (type: FloorPlanElementType) => quantities[type] ?? DEFAULT_QUANTITY;

  const setQty = (type: FloorPlanElementType, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [type]: Math.min(MAX_QUANTITY, Math.max(DEFAULT_QUANTITY, value)),
    }));
  };

  const activeQty = getQty(activeType);
  const activeLabel = SHORT_LABELS[activeType] ?? getElementDefinition(activeType).label;
  const searchLower = search.trim().toLowerCase();

  const filteredCategories = React.useMemo(() => {
    if (!searchLower) return TOOLBOX_CATEGORIES;
    return TOOLBOX_CATEGORIES.map((cat) => ({
      ...cat,
      types: cat.types.filter((type) => {
        const def = getElementDefinition(type);
        const label = SHORT_LABELS[type] ?? def.label;
        return label.toLowerCase().includes(searchLower) || def.label.toLowerCase().includes(searchLower);
      }),
    })).filter((cat) => cat.types.length > 0);
  }, [searchLower]);

  const beginDrag = (type: FloorPlanElementType, event: React.PointerEvent) => {
    event.preventDefault();
    setActiveType(type);
    startPlacementDrag({ mode: "element", type, quantity: getQty(type) });
  };

  return (
    <aside className="flex h-full min-h-0 w-[116px] shrink-0 flex-col border-r border-border/50 bg-[#fafbfc]">
      {onBack ? (
        <div className="shrink-0 border-b border-border/50 p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full gap-1.5 rounded-lg px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            Back
          </Button>
        </div>
      ) : null}

      <div className="shrink-0 border-b border-border/50 px-2.5 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Elements
        </p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="h-7 rounded-md border-border/50 bg-background pl-7 text-[10px] placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 py-2">
        {filteredCategories.map((category) => (
          <div key={category.label}>
            <p className="mb-1.5 px-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {category.label}
            </p>
            <div className="flex flex-col gap-1">
              {category.types.map((type) => {
                const def = getElementDefinition(type);
                const Icon = ICONS[type] ?? LayoutGrid;
                const qty = getQty(type);
                const isActive = activeType === type;
                const label = SHORT_LABELS[type] ?? def.label;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    onPointerDown={(e) => beginDrag(type, e)}
                    title={`Drag ${def.label} onto the grid`}
                    className={cn(
                      "group/element relative flex w-full cursor-grab items-center gap-1.5 rounded-lg border px-1.5 py-2 transition-all duration-150 active:cursor-grabbing",
                      isActive
                        ? "border-primary/40 bg-primary/8 shadow-sm ring-1 ring-primary/20"
                        : "border-transparent bg-background hover:border-border/60 hover:bg-muted/40 hover:shadow-sm",
                    )}
                  >
                    <GripVertical
                      className="h-3 w-3 shrink-0 text-muted-foreground/30 group-hover/element:text-muted-foreground/60"
                      aria-hidden
                    />
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/40 bg-background shadow-sm"
                      style={{ borderColor: `${def.borderColor}55` }}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{ color: def.borderColor }}
                        strokeWidth={2}
                      />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-left text-[9px] font-semibold leading-tight text-foreground/85">
                      {label}
                    </span>
                    {qty > 1 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground shadow-sm">
                        {qty}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-border/50 bg-muted/20 p-2.5">
        <p className="mb-2 truncate text-center text-[9px] font-medium text-muted-foreground">
          Place {activeQty > 1 ? `${activeQty}× ` : ""}
          {activeLabel}
        </p>
        <div className="flex items-center justify-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-md border-border/50"
            onClick={() => setQty(activeType, activeQty - 1)}
            disabled={activeQty <= 1}
            aria-label="Decrease quantity"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="min-w-[1.75rem] text-center text-xs font-bold tabular-nums">{activeQty}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-md border-border/50"
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
