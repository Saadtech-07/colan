"use client";

import * as React from "react";
import { ArrowLeft, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeatingFloorPlan } from "@/components/seating/seating-floor-plan";
import type { SeatingRowConfig } from "@/lib/seating-layout";
import type { GeneratedSeatingLayout } from "@/lib/seating-layout-types";
import type { SeatingAiZone } from "@/lib/seating-ai-types";
import type { Employee } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  occupancy: Map<string, Employee>;
  selectedSeat: string | null;
  highlightSeats: Set<string> | null;
  rows?: SeatingRowConfig[];
  layoutMode?: boolean;
  generatedLayout?: GeneratedSeatingLayout | null;
  layoutSeats?: Set<string> | null;
  layoutZones?: SeatingAiZone[];
  zoneBySeat?: Map<string, string>;
  teamFilter: string;
  search: string;
  viewMode: "all" | "occupied" | "available";
  canAssign: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onSeatClick: (seatId: string) => void;
  onAssignSeat: (seatId: string, employeeId: string) => void;
};

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.6;

export function SeatingFloorPlanFullscreen({
  open,
  onClose,
  title,
  subtitle,
  zoom,
  onZoomChange,
  ...floorPlanProps
}: Props) {
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
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
            onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoom - 0.08))}
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
            onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoom + 0.08))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.25)_100%)] scroll-smooth">
        <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
          <SeatingFloorPlan zoom={zoom} {...floorPlanProps} />
        </div>
      </div>
    </div>
  );
}
