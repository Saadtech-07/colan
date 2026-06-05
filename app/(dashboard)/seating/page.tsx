"use client";

import * as React from "react";
import { ArrowLeft, LayoutGrid, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeatingAnalyticsOverview } from "@/components/seating/seating-analytics-overview";
import { SeatingAssignmentDialog } from "@/components/seating/seating-assignment-dialog";
import { SeatingFloorPlan } from "@/components/seating/seating-floor-plan";
import {
  requestSeatingAiGeneration,
  SeatingAiPanel,
} from "@/components/seating/seating-ai-panel";
import { SeatingToolbar } from "@/components/seating/seating-toolbar";
import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";
import type { Employee } from "@/types";
import { layoutSeatSet, zoneLabelBySeat } from "@/lib/seating-ai-layout-builder";
import {
  buildLayoutCanvasOccupancy,
  cloneOccupancyMap,
  isAiLayoutMode,
} from "@/lib/seating-ai-preview";
import { ALL_SEAT_IDS } from "@/lib/seating-layout";
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
  const [zoom, setZoom] = React.useState(0.88);
  const [selectedSeat, setSelectedSeat] = React.useState<string | null>(null);
  const [dialogSeat, setDialogSeat] = React.useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = React.useState(false);
  const [aiSuggestion, setAiSuggestion] = React.useState<SeatingAiSuggestion | null>(null);
  const [colanOccupancySnapshot, setColanOccupancySnapshot] =
    React.useState<Map<string, Employee> | null>(null);

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
    if (colanFrozen && colanOccupancySnapshot) {
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
    clearAiLayout();
    setColanOccupancySnapshot(null);
    setZoom(0.88);
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

  const liveStats = React.useMemo(() => computeSeatingStats(employees), [employees]);
  const headerStats = layoutMode || colanFrozen ? stats : liveStats;

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4">
      <section className="shrink-0 overflow-hidden rounded-[28px] border border-border/70 bg-background/80 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5" />
              Workspace
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Seating arrangement
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Assign bays on the floor plan. Scroll the map to view all rows; use zoom and filters
              to focus on teams or availability.
            </p>
          </div>

          {canAssign && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={aiPanelOpen ? "default" : "outline"}
                className="h-10 rounded-xl gap-2"
                onClick={() => setAiPanelOpen((open) => !open)}
              >
                <Sparkles className="h-4 w-4" />
                AI seating generator
              </Button>
              {layoutMode && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 rounded-xl gap-2"
                  onClick={clearAiLayout}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Colan arrangement
                </Button>
              )}
              {colanFrozen && !layoutMode && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl gap-2"
                  onClick={exitColanFrozenView}
                >
                  Show live Colan seating
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mt-5">
          <SeatingAnalyticsOverview stats={headerStats} compact />
        </div>
      </section>

      <SeatingToolbar
        search={search}
        onSearchChange={setSearch}
        teamFilter={teamFilter}
        onTeamFilterChange={setTeamFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        teamNames={teamNames}
        stats={headerStats}
        zoom={zoom}
        onZoomChange={setZoom}
        onReset={resetFilters}
      />

      {canAssign && aiPanelOpen && (
        <SeatingAiPanel
          open={aiPanelOpen}
          onOpenChange={setAiPanelOpen}
          loading={aiGenerating}
          suggestion={aiSuggestion}
          onGenerateText={handleGenerateText}
          onBackToColan={clearAiLayout}
        />
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {layoutMode ? "New layout canvas" : "Floor layout"}
            </p>
            <p className="text-xs text-muted-foreground">
              {layoutMode
                ? "Desks from your AI prompt — assignments save immediately."
                : colanFrozen
                  ? "Frozen Colan view from before the layout planner."
                  : "Click a seat to view or assign · drag employees when permitted"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {layoutMode && (
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 font-medium text-violet-800 dark:text-violet-200">
                Layout planner
              </span>
            )}
            {colanFrozen && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-900 dark:text-amber-200">
                Colan frozen
              </span>
            )}
            <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 tabular-nums text-muted-foreground">
              Zoom {Math.round(zoom * 100)}%
            </span>
            <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 tabular-nums text-muted-foreground">
              {headerStats.occupied} / {headerStats.total} occupied
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,hsl(var(--muted)/0.35)_0%,hsl(var(--background))_48%)] scroll-smooth">
          <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
            <SeatingFloorPlan
              occupancy={displayOccupancy}
              selectedSeat={selectedSeat}
              highlightSeats={highlights}
              layoutMode={layoutMode}
              generatedLayout={aiSuggestion?.layout ?? null}
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
      </section>

      {!canAssign && (
        <p className="shrink-0 text-sm text-muted-foreground">
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
