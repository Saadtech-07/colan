"use client";

import * as React from "react";
import { SeatingAnalyticsOverview } from "@/components/seating/seating-analytics-overview";
import { SeatingAssignmentDialog } from "@/components/seating/seating-assignment-dialog";
import { SeatingFloorPlan } from "@/components/seating/seating-floor-plan";
import { SeatingLegend } from "@/components/seating/seating-legend";
import { SeatingMinimap } from "@/components/seating/seating-minimap";
import { SeatingToolbar } from "@/components/seating/seating-toolbar";
import { SEATING_ROWS } from "@/lib/seating-layout";
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
  const floorRef = React.useRef<HTMLDivElement>(null);

  const saving = isLoadingKey("seating-assign");
  const occupancy = React.useMemo(() => seatOccupancyMap(employees), [employees]);
  const stats = React.useMemo(() => computeSeatingStats(employees), [employees]);
  const highlights = React.useMemo(
    () => highlightedSeatIds(employees, { team: teamFilter, search }),
    [employees, teamFilter, search],
  );

  const occupancyRateByRow = React.useMemo(() => {
    const rates: Record<string, number> = {};
    for (const row of SEATING_ROWS) {
      const seatIds = [...row.top, ...row.bottom]
        .filter((c) => c.kind === "seat")
        .map((c) => c.id);
      const occ = seatIds.filter((id) => occupancy.has(id)).length;
      rates[row.key] = seatIds.length ? occ / seatIds.length : 0;
    }
    return rates;
  }, [occupancy]);

  const occupiedSeatsByRow = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of SEATING_ROWS) {
      const seatIds = [...row.top, ...row.bottom]
        .filter((c) => c.kind === "seat")
        .map((c) => c.id);
      counts[row.key] = seatIds.filter((id) => occupancy.has(id)).length;
    }
    return counts;
  }, [occupancy]);

  const resetFilters = () => {
    setSearch("");
    setTeamFilter("All");
    setViewMode("all");
    setSelectedSeat(null);
    setFocusRow(null);
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
    });
  };

  const handleSeatClick = (seatId: string) => {
    setSelectedSeat(seatId);
    if (canAssign) setDialogSeat(seatId);
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

      <section className="space-y-5">
        <div className="rounded-[28px] border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Seating arrangement
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Floor layout
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The seating map is the primary workspace for assignment and visibility.
                Scroll horizontally when needed and click any seat to inspect or assign.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-background/85 px-3 py-1.5">
                Zoom {Math.round(zoom * 100)}%
              </span>
              <span className="rounded-full border border-border/70 bg-background/85 px-3 py-1.5">
                {stats.occupied} occupied of {stats.total}
              </span>
            </div>
          </div>

          <div className="h-[calc(100vh-16rem)] min-h-[560px] overflow-auto rounded-[24px] border border-border/60 bg-gradient-to-br from-muted/30 via-background to-muted/20 shadow-inner scroll-smooth">
            <div ref={floorRef} className="min-h-full p-4 md:p-6 xl:p-8">
              <div className="mx-auto min-w-full w-max">
                <SeatingFloorPlan
                  occupancy={occupancy}
                  selectedSeat={selectedSeat}
                  highlightSeats={highlights}
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
          const emp = dialogSeat ? occupancy.get(dialogSeat) : null;
          if (!emp) return;
          void runAssign(targetSeatId, emp.id);
        }}
      />
    </div>
  );
}
