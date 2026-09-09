"use client";

import { BuilderFloorPlanView } from "@/components/floor-plan-builder/builder-floor-plan-view";
import { ensureWorkspaceBlocks } from "@/lib/floor-plan-builder/workspace-blocks";
import type { FloorPlanLayoutState } from "@/lib/floor-plan-builder/types";
import type { Employee } from "@/types";

type SharedViewProps = {
  occupancy: Map<string, Employee>;
  selectedSeat: string | null;
  highlightSeats: Set<string> | null;
  teamFilter: string;
  search: string;
  viewMode: "all" | "occupied" | "available";
  canAssign: boolean;
  zoom: number;
  onSeatClick: (seatId: string) => void;
  onViewSeatHistory?: (seatId: string) => void;
  onAssignSeat: (seatId: string, employeeId: string) => void;
  onSwapSeats?: (fromSeatId: string, toSeatId: string) => void;
};

type Props = SharedViewProps & {
  layout: FloorPlanLayoutState;
};

export function BuilderWorkspaceFloorPlanView({ layout, ...props }: Props) {
  const blocks = ensureWorkspaceBlocks(layout);

  if (blocks.length <= 1) {
    return <BuilderFloorPlanView layout={layout} {...props} />;
  }

  return (
    <div className="flex w-max flex-col gap-10">
      {blocks.map((block) => (
        <section key={block.id} className="w-max">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{block.name}</h3>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {block.elements.filter((el) => el.type === "seat").length} seats
            </span>
          </div>
          <BuilderFloorPlanView
            layout={{
              ...layout,
              name: block.name,
              grid: block.grid,
              elements: block.elements,
            }}
            {...props}
          />
        </section>
      ))}
    </div>
  );
}
