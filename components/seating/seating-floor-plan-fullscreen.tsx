"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeatingFloorPlan } from "@/components/seating/seating-floor-plan";
import { SeatingScrollViewport } from "@/components/seating/seating-scroll-viewport";
import type { SeatingRowConfig } from "@/lib/seating-layout";
import type { SeatingCabin } from "@/lib/seating-cabins";
import type { SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import type { GeneratedSeatingLayout } from "@/lib/seating-layout-types";
import type { SeatingAiZone } from "@/lib/seating-ai-types";
import type { Employee } from "@/types";

export type SeatingFullscreenBlock = {
  key: string;
  label: string;
  officeSlug: string;
  occupancy: Map<string, Employee>;
  cabinOccupancy?: Map<string, Employee>;
  rows: SeatingRowConfig[];
  showCabins?: boolean;
  cabinsBeforeA?: SeatingCabin[];
  cabinsAfterG?: SeatingCabin[];
  sideCabins?: SideCabinsConfig;
  outsideEntrance?: { text: string } | null;
};

type SharedFloorProps = {
  selectedSeat: string | null;
  selectedCabinId?: string | null;
  highlightSeats: Set<string> | null;
  layoutMode?: boolean;
  generatedLayout?: GeneratedSeatingLayout | null;
  layoutSeats?: Set<string> | null;
  layoutZones?: SeatingAiZone[];
  zoneBySeat?: Map<string, string>;
  teamFilter: string;
  search: string;
  viewMode: "all" | "occupied" | "available";
  canAssign: boolean;
  onSeatClick: (seatId: string, officeSlug: string) => void;
  onCabinClick?: (cabinId: string, officeSlug: string) => void;
  onAssignSeat: (seatId: string, employeeId: string, officeSlug: string) => void;
  onSwapSeats?: (fromSeatId: string, toSeatId: string, officeSlug: string) => void;
};

type Props = SharedFloorProps & {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  /** One or more floor blocks (Chennai View shows Block A + Block B). */
  blocks: SeatingFullscreenBlock[];
};

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1;
const ZOOM_STEP = 0.08;

export function SeatingFloorPlanFullscreen({
  open,
  onClose,
  title,
  subtitle,
  blocks,
  selectedSeat,
  selectedCabinId = null,
  highlightSeats,
  layoutMode = false,
  generatedLayout = null,
  layoutSeats = null,
  layoutZones = [],
  zoneBySeat = new Map(),
  teamFilter,
  search,
  viewMode,
  canAssign,
  onSeatClick,
  onCabinClick,
  onAssignSeat,
  onSwapSeats,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setZoom(1);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Let assignment dialog handle Escape while it is open above this view.
      if (document.querySelector('[role="dialog"]')) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted || blocks.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex h-dvh max-h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-xl gap-2"
            onClick={onClose}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-2 py-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-border/70"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs font-medium tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-border/70"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <SeatingScrollViewport
        autoFocus
        fitWidth
        paddingClassName="p-3 sm:p-5"
        className="bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.25)_100%)]"
      >
        <div className="flex w-max flex-col gap-10">
          {blocks.map((block) => (
            <section key={block.key} className="w-max">
              {blocks.length > 1 && (
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground sm:text-base">
                    {block.label}
                  </h3>
                  <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {block.occupancy.size} occupied
                  </span>
                </div>
              )}
              <SeatingFloorPlan
                zoom={zoom}
                occupancy={block.occupancy}
                selectedSeat={selectedSeat}
                selectedCabinId={selectedCabinId}
                highlightSeats={highlightSeats}
                layoutMode={layoutMode}
                rows={block.rows}
                generatedLayout={generatedLayout}
                layoutSeats={layoutSeats}
                layoutZones={layoutZones}
                zoneBySeat={zoneBySeat}
                teamFilter={teamFilter}
                search={search}
                viewMode={viewMode}
                canAssign={canAssign}
                showCabins={block.showCabins ?? true}
                cabinsBeforeA={block.cabinsBeforeA}
                cabinsAfterG={block.cabinsAfterG}
                sideCabins={block.sideCabins}
                outsideEntrance={block.outsideEntrance}
                cabinOccupancy={block.cabinOccupancy}
                onCabinClick={
                  onCabinClick
                    ? (cabinId) => onCabinClick(cabinId, block.officeSlug)
                    : undefined
                }
                onSeatClick={(seatId) => onSeatClick(seatId, block.officeSlug)}
                onAssignSeat={(seatId, employeeId) =>
                  onAssignSeat(seatId, employeeId, block.officeSlug)
                }
                onSwapSeats={
                  onSwapSeats
                    ? (fromSeatId, toSeatId) =>
                        onSwapSeats(fromSeatId, toSeatId, block.officeSlug)
                    : undefined
                }
              />
            </section>
          ))}
        </div>
      </SeatingScrollViewport>
    </div>,
    document.body,
  );
}
