"use client";

import * as React from "react";
import { ArrowLeft, Expand, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeatingAnalyticsOverview } from "@/components/seating/seating-analytics-overview";
import { SeatingAssignmentDialog } from "@/components/seating/seating-assignment-dialog";
import { SeatingDownloadMenu } from "@/components/seating/seating-download-menu";
import {
  SeatingFloorPlan,
  type SeatingFloorPlanHandle,
} from "@/components/seating/seating-floor-plan";
import { SeatingFloorPlanFullscreen } from "@/components/seating/seating-floor-plan-fullscreen";
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
import { ALL_SEAT_IDS, SEATING_ROWS, type SeatingRowConfig } from "@/lib/seating-layout";
import { applyOccupancySwaps, applySeatingLayoutPrompt } from "@/lib/seating-layout-prompt";
import { jsPDF } from "jspdf";
import {
  computeSeatingStats,
  highlightedSeatIds,
  seatOccupancyMap,
} from "@/lib/seating-utils";
import { buildTeamMemberRoleFilterOptions } from "@/lib/team-members-ui";
import { captureLayoutImage, downloadDataUrl } from "@/lib/seating-layout-export";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";

export default function SeatingPage() {
  const { employees, assignEmployeeToBay, access, teamNames, workspaceRoles } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();
  const canAssign = access?.canAssignSeating ?? false;

  const [search, setSearch] = React.useState("");
  const [teamFilter, setTeamFilter] = React.useState("All");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [genderFilter, setGenderFilter] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<"all" | "occupied" | "available">("all");
  const [zoom, setZoom] = React.useState(0.95);
  const [fullscreenOpen, setFullscreenOpen] = React.useState(false);
  const floorPlanRef = React.useRef<SeatingFloorPlanHandle>(null);
  const [selectedSeat, setSelectedSeat] = React.useState<string | null>(null);
  const [dialogSeat, setDialogSeat] = React.useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = React.useState(false);
  const [aiSuggestion, setAiSuggestion] = React.useState<SeatingAiSuggestion | null>(null);
  const [colanOccupancySnapshot, setColanOccupancySnapshot] =
    React.useState<Map<string, Employee> | null>(null);
  const [promptRows, setPromptRows] = React.useState<SeatingRowConfig[] | null>(null);
  const [promptSummary, setPromptSummary] = React.useState<string | null>(null);
  const [promptWarnings, setPromptWarnings] = React.useState<string[]>([]);
  const [promptOccupancySwaps, setPromptOccupancySwaps] = React.useState<
    Array<[string, string]>
  >([]);

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
  const promptLayoutActive = !layoutMode && promptRows !== null;
  const activeRows = promptRows ?? SEATING_ROWS;

  const activeSeatIds = React.useMemo(() => {
    const next: string[] = [];
    for (const row of activeRows) {
      for (const cell of [...row.top, ...row.bottom]) {
        if (cell.kind === "seat") next.push(cell.id);
      }
    }
    return next;
  }, [activeRows]);

  const displayOccupancy = React.useMemo(() => {
    if (layoutMode && layoutSeats) {
      return buildLayoutCanvasOccupancy(employees, layoutSeats);
    }
    if (colanFrozen) return colanOccupancySnapshot;
    if (promptLayoutActive && promptOccupancySwaps.length > 0) {
      return applyOccupancySwaps(savedOccupancy, promptOccupancySwaps);
    }
    return savedOccupancy;
  }, [
    layoutMode,
    layoutSeats,
    colanFrozen,
    colanOccupancySnapshot,
    savedOccupancy,
    employees,
    promptLayoutActive,
    promptOccupancySwaps,
  ]);

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
    if (promptLayoutActive) {
      const seatSet = new Set(activeSeatIds);
      let occupied = 0;
      for (const seatId of seatSet) {
        if (displayOccupancy.has(seatId)) occupied += 1;
      }
      return {
        total: seatSet.size,
        occupied,
        empty: seatSet.size - occupied,
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

  const roleFilterOptions = React.useMemo(
    () => buildTeamMemberRoleFilterOptions(workspaceRoles),
    [workspaceRoles],
  );

  React.useEffect(() => {
    if (roleFilter === "all") return;
    if (!roleFilterOptions.some((option) => option.value === roleFilter)) {
      setRoleFilter("all");
    }
  }, [roleFilter, roleFilterOptions]);

  const highlights = React.useMemo(
    () =>
      layoutMode
        ? null
        : highlightedSeatIds(
            employees,
            { team: teamFilter, search, role: roleFilter, gender: genderFilter },
            workspaceRoles,
          ),
    [employees, teamFilter, search, roleFilter, genderFilter, workspaceRoles, layoutMode],
  );

  const clearAiLayout = React.useCallback(() => {
    setAiSuggestion(null);
  }, []);

  const resetPromptLayout = React.useCallback(() => {
    setPromptRows(null);
    setPromptSummary(null);
    setPromptWarnings([]);
    setPromptOccupancySwaps([]);
  }, []);

  const exitColanFrozenView = React.useCallback(() => {
    setColanOccupancySnapshot(null);
  }, []);

  const resetFilters = () => {
    setSearch("");
    setTeamFilter("All");
    setRoleFilter("all");
    setGenderFilter("all");
    setViewMode("all");
    setSelectedSeat(null);
    clearAiLayout();
    setColanOccupancySnapshot(null);
    resetPromptLayout();
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

  const handleApplyColanPrompt = React.useCallback(
    (prompt: string) => {
      const baseRows = promptRows ?? SEATING_ROWS;
      const result = applySeatingLayoutPrompt(baseRows, prompt);
      setPromptRows(result.rows);
      setPromptSummary(result.summary);
      setPromptWarnings(result.warnings);
      setPromptOccupancySwaps((previous) => [...previous, ...result.occupancySwaps]);
      setSelectedSeat(null);
      setDialogSeat(null);
      setAiSuggestion(null);
      setColanOccupancySnapshot(null);
      setAiPanelOpen(true);
      setViewMode("all");
    },
    [promptRows, setViewMode],
  );

  const handleSeatClick = (seatId: string) => {
    if (layoutMode && layoutSeats && !layoutSeats.has(seatId)) return;
    if (promptLayoutActive) return;
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

  const handleGenerateImage = async (payload: {
    imageBase64: string;
    mimeType: string;
    notes?: string;
    fileName?: string;
  }) => {
    await withLoading("seating-ai-generate", LOADING_PRESETS.seatingAiGenerate, async () => {
      const suggestion = await requestSeatingAiGeneration({ mode: "image", ...payload });
      freezeColanForLayout();
      setAiSuggestion(suggestion);
      setAiPanelOpen(true);
      setViewMode("all");
    });
  };

  const liveStats = React.useMemo(() => computeSeatingStats(employees), [employees]);
  const headerStats = layoutMode || colanFrozen ? stats : liveStats;

  const exportSeatIds = React.useMemo(() => {
    if (layoutMode && layoutSeats) return Array.from(layoutSeats);
    if (colanFrozen) return ALL_SEAT_IDS;
    if (promptLayoutActive) return activeSeatIds;
    return ALL_SEAT_IDS;
  }, [layoutMode, layoutSeats, colanFrozen, promptLayoutActive, activeSeatIds]);

  const exportRows = React.useMemo(() => {
    return exportSeatIds
      .slice()
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((seatId) => {
        const occupant = displayOccupancy.get(seatId) ?? null;
        return {
          seatId,
          status: occupant ? "Occupied" : "Available",
          employeeId: occupant?.employeeId ?? "",
          name: occupant?.name ?? "",
          team: occupant?.team ?? "",
          role: occupant?.role ?? "",
        };
      });
  }, [displayOccupancy, exportSeatIds]);

  const downloadFile = React.useCallback((name: string, mime: string, content: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportCsv = React.useCallback(() => {
    const headers = ["Seat", "Status", "Employee ID", "Name", "Team", "Role"];
    const esc = (value: string) => {
      const v = String(value ?? "");
      if (v.includes(",") || v.includes("\"") || v.includes("\n")) return `"${v.replace(/"/g, "\"\"")}"`;
      return v;
    };
    const lines = [
      headers.join(","),
      ...exportRows.map((r) =>
        [r.seatId, r.status, r.employeeId, r.name, r.team, r.role].map(esc).join(","),
      ),
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`seating-layout-${stamp}.csv`, "text/csv;charset=utf-8", lines.join("\n"));
  }, [downloadFile, exportRows]);

  const exportPdf = React.useCallback(() => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const marginX = 40;
    const marginY = 44;
    const lineH = 14;
    const pageH = doc.internal.pageSize.getHeight();
    const maxY = pageH - marginY;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Seating layout export", marginX, marginY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const meta = `Generated: ${new Date().toLocaleString()}`;
    doc.text(meta, marginX, marginY + 18);

    let y = marginY + 42;
    const writeLine = (text: string) => {
      if (y > maxY) {
        doc.addPage();
        y = marginY;
      }
      doc.text(text, marginX, y);
      y += lineH;
    };

    doc.setFont("helvetica", "bold");
    writeLine("Seat | Status | Employee ID | Name | Team | Role");
    doc.setFont("helvetica", "normal");

    exportRows.forEach((r) => {
      const line = `${r.seatId} | ${r.status} | ${r.employeeId || "-"} | ${r.name || "-"} | ${r.team || "-"} | ${r.role || "-"}`;
      // truncate overly long lines to avoid wrapping issues in simple text layout
      writeLine(line.length > 140 ? `${line.slice(0, 137)}…` : line);
    });

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`seating-layout-${stamp}.pdf`);
  }, [exportRows]);

  const exportLayoutImage = React.useCallback(async () => {
    try {
      const dataUrl = await captureLayoutImage({
        canvas: floorPlanRef.current?.getLayoutCanvas() ?? null,
        element: floorPlanRef.current?.getFloorPlanElement() ?? null,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadDataUrl(`seating-layout-${stamp}.png`, dataUrl);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not export layout image.");
    }
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4">
      <section className="shrink-0 overflow-hidden rounded-[28px] border border-border/70 bg-background/80 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Seating arrangement
            </h1>
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
              {promptLayoutActive && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 rounded-xl gap-2"
                  onClick={resetPromptLayout}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Colan arrangement
                </Button>
              )}
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
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        roleFilterOptions={roleFilterOptions}
        genderFilter={genderFilter}
        onGenderFilterChange={setGenderFilter}
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
          onGenerateImage={handleGenerateImage}
          onBackToColan={clearAiLayout}
          onApplyColanPrompt={handleApplyColanPrompt}
          colanPromptSummary={promptSummary}
          colanPromptWarnings={promptWarnings}
        />
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {layoutMode ? "New layout canvas" : promptLayoutActive ? "Edited Colan layout" : "Floor layout"}
            </p>
            <p className="text-xs text-muted-foreground">
              {layoutMode
                ? "Desks from your AI prompt — assignments save immediately."
                : promptLayoutActive
                  ? "Layout changed from your prompt — use Back to Colan arrangement to restore the original."
                  : colanFrozen
                    ? "Frozen Colan view from before the layout planner."
                    : "Click a seat to view or assign · drag employees when permitted"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg gap-1.5 px-2.5 text-xs"
              onClick={() => setFullscreenOpen(true)}
            >
              <Expand className="h-3.5 w-3.5" />
              View
            </Button>
            <SeatingDownloadMenu
              onExportImage={exportLayoutImage}
              onExportPdf={exportPdf}
              onExportExcel={exportCsv}
            />
            {layoutMode && (
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 font-medium text-violet-800 dark:text-violet-200">
                Layout planner
              </span>
            )}
            {promptLayoutActive && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-900 dark:text-emerald-200">
                Prompt layout
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

        <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.25)_100%)] scroll-smooth">
          <div className="flex min-h-full min-w-full items-center justify-center p-4 sm:p-6">
            <SeatingFloorPlan
              ref={floorPlanRef}
              occupancy={displayOccupancy}
              selectedSeat={selectedSeat}
              highlightSeats={highlights}
              layoutMode={layoutMode}
              rows={activeRows}
              generatedLayout={aiSuggestion?.layout ?? null}
              layoutSeats={layoutSeats}
              layoutZones={layoutZones}
              zoneBySeat={zoneBySeat}
              teamFilter={teamFilter}
              search={search}
              viewMode={viewMode}
              canAssign={canAssign && !promptLayoutActive}
              zoom={zoom}
              showCabins={!layoutMode}
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

      <SeatingFloorPlanFullscreen
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        title={layoutMode ? "New layout canvas" : "Floor layout"}
        subtitle={
          layoutMode
            ? "Desks from your AI prompt — assignments save immediately."
            : colanFrozen
              ? "Frozen Colan view from before the layout planner."
              : "Click a seat to view or assign · drag employees when permitted"
        }
        occupancy={displayOccupancy}
        selectedSeat={selectedSeat}
        highlightSeats={highlights}
        layoutMode={layoutMode}
        rows={activeRows}
        generatedLayout={aiSuggestion?.layout ?? null}
        layoutSeats={layoutSeats}
        layoutZones={layoutZones}
        zoneBySeat={zoneBySeat}
        teamFilter={teamFilter}
        search={search}
        viewMode={viewMode}
        canAssign={canAssign && !promptLayoutActive}
        zoom={zoom}
        showCabins={!layoutMode}
        onZoomChange={setZoom}
        onSeatClick={handleSeatClick}
        onAssignSeat={(seatId, employeeId) => void runAssign(seatId, employeeId)}
      />

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
