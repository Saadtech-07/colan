"use client";



import * as React from "react";

import { ArrowLeft, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SeatingAnalyticsOverview } from "@/components/seating/seating-analytics-overview";

import { SeatingAssignmentDialog } from "@/components/seating/seating-assignment-dialog";

import { SeatingFloorPlan } from "@/components/seating/seating-floor-plan";

import { SeatingLegend } from "@/components/seating/seating-legend";

import { SeatingMinimap } from "@/components/seating/seating-minimap";

import {

  requestSeatingAiGeneration,

  SeatingAiPanel,

} from "@/components/seating/seating-ai-panel";

import { SeatingToolbar } from "@/components/seating/seating-toolbar";

import { imageFileToBase64Payload } from "@/lib/seating-ai-client";
import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";
import type { Employee } from "@/types";

import { layoutSeatSet, zoneLabelBySeat } from "@/lib/seating-ai-layout-builder";

import {
  buildLayoutCanvasOccupancy,
  cloneOccupancyMap,
  isAiLayoutMode,
} from "@/lib/seating-ai-preview";

import { ALL_SEAT_IDS, SEATING_ROWS } from "@/lib/seating-layout";

import {

  computeSeatingStats,

  highlightedSeatIds,

  seatOccupancyMap,

} from "@/lib/seating-utils";

import { LOADING_PRESETS } from "@/lib/loading-presets";

import { useAppState } from "@/providers/app-state";

import { useGlobalLoading } from "@/providers/global-loading";



export default function SeatingPage() {

  const { employees, assignEmployeeToBay, access, teamNames } = useAppState();

  const { withLoading, isLoadingKey } = useGlobalLoading();

  const canAssign = access?.canAssignSeating ?? false;



  const [search, setSearch] = React.useState("");

  const [teamFilter, setTeamFilter] = React.useState("All");

  const [viewMode, setViewMode] = React.useState<"all" | "occupied" | "available">("all");

  const [zoom, setZoom] = React.useState(1);

  const [selectedSeat, setSelectedSeat] = React.useState<string | null>(null);

  const [dialogSeat, setDialogSeat] = React.useState<string | null>(null);

  const [focusRow, setFocusRow] = React.useState<string | null>(null);

  const [aiPanelOpen, setAiPanelOpen] = React.useState(false);

  const [aiSuggestion, setAiSuggestion] = React.useState<SeatingAiSuggestion | null>(null);
  const [colanOccupancySnapshot, setColanOccupancySnapshot] =
    React.useState<Map<string, Employee> | null>(null);

  const floorRef = React.useRef<HTMLDivElement>(null);



  const saving = isLoadingKey("seating-assign");

  const aiGenerating = isLoadingKey("seating-ai-generate");

  const savedOccupancy = React.useMemo(() => seatOccupancyMap(employees), [employees]);

  const layoutMode = isAiLayoutMode(aiSuggestion);

  const layoutSeats = React.useMemo(() => layoutSeatSet(aiSuggestion), [aiSuggestion]);

  const zoneBySeat = React.useMemo(() => zoneLabelBySeat(aiSuggestion), [aiSuggestion]);

  const layoutZones = React.useMemo(() => {
    if (!aiSuggestion?.zones.length && aiSuggestion?.layoutSeats.length) {
      return [
        {
          id: "layout",
          label: "Generated layout",
          seatIds: aiSuggestion.layoutSeats,
        },
      ];
    }
    return aiSuggestion?.zones ?? [];
  }, [aiSuggestion]);



  const colanFrozen = !layoutMode && colanOccupancySnapshot !== null;

  const displayOccupancy = React.useMemo(() => {
    if (layoutMode && layoutSeats) {
      return buildLayoutCanvasOccupancy(employees, layoutSeats);
    }
    if (colanFrozen) return colanOccupancySnapshot;
    return savedOccupancy;
  }, [layoutMode, layoutSeats, colanFrozen, colanOccupancySnapshot, savedOccupancy, employees]);

  const stats = React.useMemo(() => {
    if (layoutMode && layoutSeats) {
      const occupied = displayOccupancy.size;
      return {
        total: layoutSeats.size,
        occupied,
        empty: layoutSeats.size - occupied,
        legacyUnassigned: 0,
      };
    }
    if (colanFrozen) {
      return {
        total: ALL_SEAT_IDS.length,
        occupied: colanOccupancySnapshot.size,
        empty: ALL_SEAT_IDS.length - colanOccupancySnapshot.size,
        legacyUnassigned: 0,
      };
    }
    return computeSeatingStats(employees);
  }, [layoutMode, layoutSeats, colanFrozen, colanOccupancySnapshot, displayOccupancy, employees]);



  const highlights = React.useMemo(

    () => (layoutMode ? null : highlightedSeatIds(employees, { team: teamFilter, search })),

    [employees, teamFilter, search, layoutMode],

  );



  const occupancyRateByRow = React.useMemo(() => {
    const rates: Record<string, number> = {};
    for (const row of SEATING_ROWS) {
      const seatIds = [...row.top, ...row.bottom]
        .filter((c) => c.kind === "seat")
        .map((c) => c.id);
      const occ = seatIds.filter((id) => displayOccupancy.has(id)).length;
      rates[row.key] = seatIds.length ? occ / seatIds.length : 0;
    }
    return rates;
  }, [displayOccupancy]);

  const occupiedSeatsByRow = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of SEATING_ROWS) {
      const seatIds = [...row.top, ...row.bottom]
        .filter((c) => c.kind === "seat")
        .map((c) => c.id);
      counts[row.key] = seatIds.filter((id) => displayOccupancy.has(id)).length;
    }
    return counts;
  }, [displayOccupancy]);



  const clearAiLayout = React.useCallback(() => {
    setAiSuggestion(null);
  }, []);

  const exitColanFrozenView = React.useCallback(() => {
    setColanOccupancySnapshot(null);
  }, []);



  const resetFilters = () => {

    setSearch("");

    setTeamFilter("All");

    setViewMode("all");

    setSelectedSeat(null);

    setFocusRow(null);

    clearAiLayout();
    setColanOccupancySnapshot(null);

  };



  const scrollToRow = (rowKey: string) => {

    setFocusRow(rowKey);

    const el = floorRef.current?.querySelector(`[data-row="${rowKey}"]`);

    el?.scrollIntoView({ behavior: "smooth", block: "center" });

  };



  const runAssign = async (seatId: string, employeeId: string | null) => {
    await withLoading("seating-assign", LOADING_PRESETS.assigningBay, async () => {
      await assignEmployeeToBay(seatId, employeeId);
      setDialogSeat(null);
      setSelectedSeat(employeeId ? seatId : null);
      if (!layoutMode) {
        setColanOccupancySnapshot(null);
      }
    });
  };

  const freezeColanForLayout = React.useCallback(() => {
    setColanOccupancySnapshot(cloneOccupancyMap(savedOccupancy));
  }, [savedOccupancy]);



  const handleSeatClick = (seatId: string) => {

    if (layoutMode && layoutSeats && !layoutSeats.has(seatId)) return;

    setSelectedSeat(seatId);

    if (canAssign) setDialogSeat(seatId);

  };



  const handleGenerateText = async (prompt: string) => {

    await withLoading("seating-ai-generate", LOADING_PRESETS.seatingAiGenerate, async () => {

      const suggestion = await requestSeatingAiGeneration({ mode: "text", prompt });
      freezeColanForLayout();
      setAiSuggestion(suggestion);
      setAiPanelOpen(true);
      setViewMode("all");
    });
  };



  const handleGenerateImage = async (file: File, prompt?: string) => {

    const { imageBase64, mimeType } = await imageFileToBase64Payload(file);

    await withLoading("seating-ai-generate", LOADING_PRESETS.seatingAiGenerate, async () => {

      const suggestion = await requestSeatingAiGeneration({

        mode: "image",

        prompt,

        imageBase64,

        mimeType,

      });

      freezeColanForLayout();
      setAiSuggestion(suggestion);
      setAiPanelOpen(true);
      setViewMode("all");
    });
  };

  return (

    <div className="space-y-6">

      <SeatingAnalyticsOverview stats={stats} />



      <SeatingToolbar

        search={search}

        onSearchChange={setSearch}

        teamFilter={teamFilter}

        onTeamFilterChange={setTeamFilter}

        viewMode={viewMode}

        onViewModeChange={setViewMode}

        teamNames={teamNames}

        stats={stats}

        zoom={zoom}

        onZoomChange={setZoom}

        onReset={resetFilters}

      />



      {canAssign && (

        <div className="flex flex-wrap items-center gap-3">

          <Button

            type="button"

            variant={aiPanelOpen ? "default" : "outline"}

            className="rounded-2xl gap-2"

            onClick={() => setAiPanelOpen((open) => !open)}

          >

            <Sparkles className="h-4 w-4" />

            AI seating generator

          </Button>

          {layoutMode && (

            <Button

              type="button"

              variant="secondary"

              className="rounded-2xl gap-2"

              onClick={clearAiLayout}

            >

              <ArrowLeft className="h-4 w-4" />

              Back to Colan arrangement

            </Button>

          )}

          {layoutMode && !aiPanelOpen && (
            <span className="text-sm text-muted-foreground">
              Assignments save to the database immediately (visible on team member profiles).
            </span>
          )}
          {colanFrozen && !layoutMode && (
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl gap-2"
              onClick={exitColanFrozenView}
            >
              Show live Colan seating
            </Button>
          )}

        </div>

      )}



      {canAssign && aiPanelOpen && (

        <SeatingAiPanel

          open={aiPanelOpen}

          onOpenChange={setAiPanelOpen}

          loading={aiGenerating}

          suggestion={aiSuggestion}

          onGenerateText={handleGenerateText}

          onGenerateImage={handleGenerateImage}

          onBackToColan={clearAiLayout}
        />

      )}



      <section className="space-y-5">

        <div className="rounded-[28px] border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-sm sm:p-5">

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">

                Seating arrangement

              </p>

              <h2 className="mt-1 text-xl font-semibold tracking-tight">

                {layoutMode ? "New layout canvas" : "Floor layout"}

              </h2>

              <p className="mt-1 text-sm text-muted-foreground">

                {layoutMode
                  ? "Only the desks from your prompt are shown. Seat assignments save to the database right away (team member pages update). Colan floor plan stays unchanged until you edit it on the Colan map."
                  : colanFrozen
                    ? "Showing the Colan floor plan from before you opened the layout planner. Assign a seat here to update Colan seating, or use Show live Colan seating to see current database assignments."
                    : "The seating map is the primary workspace for assignment and visibility. Scroll horizontally when needed and click any seat to inspect or assign."}

              </p>

            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">

              {layoutMode && (
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 font-medium text-violet-800 dark:text-violet-200">
                  Layout planner — saves to DB
                </span>
              )}
              {colanFrozen && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-medium text-amber-900 dark:text-amber-200">
                  Colan view frozen
                </span>
              )}

              <span className="rounded-full border border-border/70 bg-background/85 px-3 py-1.5">

                Zoom {Math.round(zoom * 100)}%

              </span>

              <span className="rounded-full border border-border/70 bg-background/85 px-3 py-1.5">

                {layoutMode

                  ? `${stats.empty} open desks in layout`

                  : `${stats.occupied} occupied of ${stats.total}`}

              </span>

            </div>

          </div>



          <div className="h-[calc(100vh-16rem)] min-h-[560px] overflow-auto rounded-[24px] border border-border/60 bg-gradient-to-br from-muted/30 via-background to-muted/20 shadow-inner scroll-smooth">

            <div ref={floorRef} className="min-h-full p-4 md:p-6 xl:p-8">

              <div className="mx-auto min-w-full w-max">

                <SeatingFloorPlan

                  occupancy={displayOccupancy}

                  selectedSeat={selectedSeat}

                  highlightSeats={highlights}

                  layoutMode={layoutMode}
                  layoutSeats={layoutSeats}
                  layoutZones={layoutZones}
                  zoneBySeat={zoneBySeat}

                  teamFilter={teamFilter}

                  search={search}

                  viewMode={viewMode}

                  canAssign={canAssign}

                  zoom={zoom}

                  onSeatClick={handleSeatClick}

                  onAssignSeat={(seatId, employeeId) => void runAssign(seatId, employeeId)}

                />

              </div>

            </div>

          </div>

        </div>



        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">

          <SeatingMinimap

            occupancyRateByRow={occupancyRateByRow}

            occupiedSeatsByRow={occupiedSeatsByRow}

            selectedRow={focusRow}

            onRowClick={scrollToRow}

          />

          <SeatingLegend teamNames={teamNames} />

        </div>

      </section>



      {!canAssign && (

        <p className="text-sm text-muted-foreground">

          View-only mode. Admins and project leads can assign seats from this floor plan.

        </p>

      )}



      <SeatingAssignmentDialog

        open={!!dialogSeat}

        seatId={dialogSeat}

        employees={employees}

        canAssign={canAssign}

        saving={saving}

        onClose={() => setDialogSeat(null)}

        onAssign={(employeeId) => {

          if (!dialogSeat) return;

          void runAssign(dialogSeat, employeeId);

        }}

        onRemove={() => {

          if (!dialogSeat) return;

          void runAssign(dialogSeat, null);

        }}

        onReassign={(targetSeatId) => {
          const emp = dialogSeat
            ? displayOccupancy.get(dialogSeat) ?? savedOccupancy.get(dialogSeat)
            : null;
          if (!emp) return;
          void runAssign(targetSeatId, emp.id);
        }}

      />

    </div>

  );

}


