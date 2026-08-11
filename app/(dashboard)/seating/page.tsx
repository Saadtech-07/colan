"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Expand, Pencil, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeatingAnalyticsOverview } from "@/components/seating/seating-analytics-overview";
import {
  aggregateAllBranchStats,
  SeatingBranchList,
} from "@/components/seating/seating-branch-list";
import { SeatingAssignmentDialog } from "@/components/seating/seating-assignment-dialog";
import { SeatingDownloadMenu } from "@/components/seating/seating-download-menu";
import {
  SeatingTransferConfirmDialog,
  type SeatTransferPending,
} from "@/components/seating/seating-transfer-confirm-dialog";
import {
  SeatingFloorPlan,
  type SeatingFloorPlanHandle,
} from "@/components/seating/seating-floor-plan";
import {
  SeatingFloorPlanFullscreen,
  type SeatingFullscreenBlock,
} from "@/components/seating/seating-floor-plan-fullscreen";
import { SeatingScrollViewport } from "@/components/seating/seating-scroll-viewport";
import {
  requestSeatingAiGeneration,
  SeatingAiPanel,
} from "@/components/seating/seating-ai-panel";
import { SeatingToolbar, SeatingZoomControls } from "@/components/seating/seating-toolbar";
import { SeatingOfficeSelect } from "@/components/seating/seating-office-select";
import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";
import type { Employee } from "@/types";
import { layoutSeatSet, zoneLabelBySeat } from "@/lib/seating-ai-layout-builder";
import {
  buildLayoutCanvasOccupancy,
  cloneOccupancyMap,
  isAiLayoutMode,
} from "@/lib/seating-ai-preview";
import { ALL_SEAT_IDS, SEATING_ROWS, type SeatingRowConfig } from "@/lib/seating-layout";
import {
  CHENNAI_BLOCK_A_SLUG,
  CHENNAI_BLOCK_B_SLUG,
  DEFAULT_OFFICE_SLUG,
  isChennaiOfficeSlug,
} from "@/lib/floor-plan-layouts";
import { branchKeyForPlan, blockLabelForPlan } from "@/lib/floor-plan-branch";
import {
  fetchFloorPlanDetail,
  fetchFloorPlanSummaries,
  swapFloorPlanCabinsClient,
} from "@/lib/floor-plans-client";
import type { FloorPlanDTO, FloorPlanSummary } from "@/models/floor-plan.model";
import { applyOccupancySwaps } from "@/lib/seating-layout-prompt";
import {
  CABINS_AFTER_G_ROW,
  CABINS_BEFORE_A_ROW,
  type SeatingCabin,
} from "@/lib/seating-cabins";
import type { SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import { EMPTY_SIDE_CABINS } from "@/lib/seating-layout-editor-snapshot";
import { requestColanLayoutEdit } from "@/lib/seating-layout-edit-client";
import { jsPDF } from "jspdf";
import {
  cabinOccupancyMap,
  cabinOccupantsMap,
  listCabinSlotsOnPlan,
} from "@/lib/cabin-utils";
import {
  computeSeatingStats,
  highlightedSeatIds,
  seatOccupancyMap,
} from "@/lib/seating-utils";
import { buildTeamMemberRoleFilterOptions } from "@/lib/team-members-ui";
import { captureLayoutImage, downloadDataUrl } from "@/lib/seating-layout-export";
import { cn } from "@/lib/utils";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";

export default function SeatingPage() {
  const {
    employees,
    assignEmployeeToBay,
    assignEmployeeToCabin,
    assignEmployeesToCabin,
    swapEmployeeBays,
    access,
    teamNames,
    workspaceRoles,
  } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();
  const canAssign = access?.canAssignSeating ?? false;

  const [search, setSearch] = React.useState("");
  const [teamFilter, setTeamFilter] = React.useState("All");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [genderFilter, setGenderFilter] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<"all" | "occupied" | "available">("all");
  const [zoom, setZoom] = React.useState(1);
  const [fullscreenOpen, setFullscreenOpen] = React.useState(false);
  const [viewHintActive, setViewHintActive] = React.useState(true);

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem("seating-view-hint-seen") === "1") {
        setViewHintActive(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openFullscreenView = React.useCallback(() => {
    setViewHintActive(false);
    try {
      sessionStorage.setItem("seating-view-hint-seen", "1");
    } catch {
      /* ignore */
    }
    setFullscreenOpen(true);
  }, []);
  const floorPlanRef = React.useRef<SeatingFloorPlanHandle>(null);
  const [selectedSeat, setSelectedSeat] = React.useState<string | null>(null);
  const [dialogSeat, setDialogSeat] = React.useState<string | null>(null);
  const [dialogCabinId, setDialogCabinId] = React.useState<string | null>(null);
  const [selectedCabinId, setSelectedCabinId] = React.useState<string | null>(null);
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
  const [promptCabinsBeforeA, setPromptCabinsBeforeA] = React.useState<SeatingCabin[] | null>(null);
  const [promptCabinsAfterG, setPromptCabinsAfterG] = React.useState<SeatingCabin[] | null>(null);
  const [promptSideCabins, setPromptSideCabins] = React.useState<SideCabinsConfig | null>(null);
  const [officeSlug, setOfficeSlug] = React.useState(DEFAULT_OFFICE_SLUG);
  /** Landing shows all branches; floor plan opens only after View (or ?office=). */
  const [listMode, setListMode] = React.useState(true);
  const [officePlans, setOfficePlans] = React.useState<FloorPlanSummary[]>([]);
  const [plansLoading, setPlansLoading] = React.useState(true);

  React.useEffect(() => {
    try {
      const fromQuery = new URLSearchParams(window.location.search)
        .get("office")
        ?.trim()
        .toLowerCase();
      if (fromQuery) {
        setOfficeSlug(fromQuery);
        setListMode(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const syncOfficeUrl = React.useCallback((slug: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (slug) url.searchParams.set("office", slug);
      else url.searchParams.delete("office");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    } catch {
      /* ignore */
    }
  }, []);

  const openBranchFloor = React.useCallback(
    (slug: string) => {
      setOfficeSlug(slug);
      setListMode(false);
      syncOfficeUrl(slug);
    },
    [syncOfficeUrl],
  );

  const backToBranchList = React.useCallback(() => {
    setListMode(true);
    setFullscreenOpen(false);
    setAiPanelOpen(false);
    syncOfficeUrl(null);
  }, [syncOfficeUrl]);

  const selectOfficeSlug = React.useCallback(
    (slug: string) => {
      setOfficeSlug(slug);
      if (!listMode) syncOfficeUrl(slug);
    },
    [listMode, syncOfficeUrl],
  );

  const [activePlan, setActivePlan] = React.useState<FloorPlanDTO | null>(null);
  const [companionPlan, setCompanionPlan] = React.useState<FloorPlanDTO | null>(null);
  const [planLoading, setPlanLoading] = React.useState(false);
  const [dialogOfficeSlug, setDialogOfficeSlug] = React.useState(DEFAULT_OFFICE_SLUG);
  const [seatTransferPending, setSeatTransferPending] =
    React.useState<SeatTransferPending | null>(null);

  const saving = isLoadingKey("seating-assign");
  const aiGenerating = isLoadingKey("seating-ai-generate");
  const layoutEditing = isLoadingKey("seating-layout-edit");
  const planSeatIds = activePlan?.seatIds ?? ALL_SEAT_IDS;
  const savedOccupancy = React.useMemo(
    () =>
      seatOccupancyMap(employees, {
        officeSlug,
        seatIds: planSeatIds,
      }),
    [employees, officeSlug, planSeatIds],
  );
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
  const activeRows = promptRows ?? activePlan?.rows ?? SEATING_ROWS;
  const activeCabinsBeforeA =
    promptCabinsBeforeA ??
    activePlan?.cabins?.beforeA ??
    (activePlan ? [] : CABINS_BEFORE_A_ROW);
  const activeCabinsAfterG =
    promptCabinsAfterG ??
    activePlan?.cabins?.afterG ??
    (activePlan ? [] : CABINS_AFTER_G_ROW);
  const activeSideCabins = React.useMemo(() => {
    const raw = promptSideCabins ?? activePlan?.cabins?.sideCabins;
    // Only show left/right cabins that were explicitly saved on the plan.
    // Do not fall back to DEFAULT_SIDE_CABINS (HR Manager / Manager).
    const hasSide = !!(raw?.hrManager?.trim() || raw?.manager?.trim());
    if (!hasSide || !raw) return EMPTY_SIDE_CABINS;
    if (raw.equalHeights) return raw;
    return {
      ...raw,
      equalHeights: false,
      spans: raw.spans ?? { hrManager: 1, manager: 1 },
    };
  }, [promptSideCabins, activePlan?.cabins?.sideCabins]);
  const activeOutsideEntrance =
    promptRows ? null : (activePlan?.cabins?.outsideEntrance ?? null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setPlansLoading(true);
      try {
        // Use client cache when warm (mutations already invalidate). Avoids
        // duplicate cold fetches on remount / Strict Mode.
        const plans = await fetchFloorPlanSummaries();
        if (cancelled) return;
        setOfficePlans(plans);
      } catch {
        /* keep empty list */
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (listMode) {
      setPlanLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setPlanLoading(true);
      try {
        const plan = await fetchFloorPlanDetail(officeSlug);
        if (cancelled) return;
        if (!plan) {
          setActivePlan(null);
          setCompanionPlan(null);
          return;
        }
        setActivePlan(plan);
        setDialogOfficeSlug(officeSlug);
        setSelectedSeat(null);
        setDialogSeat(null);
        setAiSuggestion(null);
        setColanOccupancySnapshot(null);
        setPromptRows(null);
        setPromptCabinsBeforeA(null);
        setPromptCabinsAfterG(null);
        setPromptSideCabins(null);
        setPromptSummary(null);
        setPromptWarnings([]);
        setPromptOccupancySwaps([]);

        if (officePlans.length > 0) {
          const branchKey = branchKeyForPlan(plan);
          const sibling = officePlans.find(
            (p) => p.slug !== plan.slug && branchKeyForPlan(p) === branchKey,
          );
          if (sibling) {
            const siblingPlan = await fetchFloorPlanDetail(sibling.slug);
            if (!cancelled) setCompanionPlan(siblingPlan);
          } else if (!cancelled) {
            setCompanionPlan(null);
          }
        } else if (isChennaiOfficeSlug(officeSlug)) {
          const siblingSlug =
            officeSlug === CHENNAI_BLOCK_A_SLUG
              ? CHENNAI_BLOCK_B_SLUG
              : CHENNAI_BLOCK_A_SLUG;
          const siblingPlan = await fetchFloorPlanDetail(siblingSlug);
          if (!cancelled) setCompanionPlan(siblingPlan);
        } else if (!cancelled) {
          setCompanionPlan(null);
        }
      } catch {
        if (!cancelled) {
          setActivePlan(null);
          setCompanionPlan(null);
        }
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listMode, officeSlug, officePlans]);

  const buildColanLayoutState = React.useCallback(
    () => ({
      rows: promptRows ?? activePlan?.rows ?? SEATING_ROWS,
      cabinsBeforeA: activeCabinsBeforeA.map((cabin) => ({ ...cabin })),
      cabinsAfterG: activeCabinsAfterG.map((cabin) => ({ ...cabin })),
      sideCabins: { ...activeSideCabins },
    }),
    [activeCabinsAfterG, activeCabinsBeforeA, activeSideCabins, activePlan, promptRows],
  );

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
        total: planSeatIds.length,
        occupied: colanOccupancySnapshot.size,
        empty: planSeatIds.length - colanOccupancySnapshot.size,
        legacyUnassigned: 0,
      };
    }
    return computeSeatingStats(employees, {
      officeSlug,
      seatIds: planSeatIds,
    });
  }, [
    layoutMode,
    layoutSeats,
    colanFrozen,
    colanOccupancySnapshot,
    displayOccupancy,
    employees,
    promptLayoutActive,
    activeSeatIds,
    officeSlug,
    planSeatIds,
  ]);

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
            {
              team: teamFilter,
              search,
              role: roleFilter,
              gender: genderFilter,
              officeSlug,
              seatIds: planSeatIds,
            },
            workspaceRoles,
          ),
    [
      employees,
      teamFilter,
      search,
      roleFilter,
      genderFilter,
      workspaceRoles,
      layoutMode,
      officeSlug,
      planSeatIds,
    ],
  );

  const clearAiLayout = React.useCallback(() => {
    setAiSuggestion(null);
  }, []);

  const resetPromptLayout = React.useCallback(() => {
    setPromptRows(null);
    setPromptCabinsBeforeA(null);
    setPromptCabinsAfterG(null);
    setPromptSideCabins(null);
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
    setZoom(1);
  };

  const cabinSlots = React.useMemo(
    () => (activePlan ? listCabinSlotsOnPlan(activePlan) : []),
    [activePlan],
  );
  const cabinIds = React.useMemo(() => cabinSlots.map((s) => s.id), [cabinSlots]);
  const cabinOccupancy = React.useMemo(
    () =>
      cabinOccupancyMap(employees, {
        officeSlug,
        cabinIds,
      }),
    [cabinIds, employees, officeSlug],
  );
  const cabinOccupants = React.useMemo(
    () =>
      cabinOccupantsMap(employees, {
        officeSlug,
        cabinIds,
      }),
    [cabinIds, employees, officeSlug],
  );
  const dialogCabinLabel = React.useMemo(() => {
    if (!dialogCabinId) return null;
    const fromActive = cabinSlots.find((s) => s.id === dialogCabinId)?.label;
    if (fromActive) return fromActive;
    if (companionPlan) {
      return (
        listCabinSlotsOnPlan(companionPlan).find((s) => s.id === dialogCabinId)
          ?.label ?? dialogCabinId
      );
    }
    return dialogCabinId;
  }, [cabinSlots, companionPlan, dialogCabinId]);

  const runAssign = async (
    seatId: string,
    employeeId: string | null,
    targetOfficeSlug = officeSlug,
  ) => {
    await withLoading("seating-assign", LOADING_PRESETS.assigningBay, async () => {
      await assignEmployeeToBay(seatId, employeeId, targetOfficeSlug);
      setDialogSeat(null);
      setDialogCabinId(null);
      setSelectedSeat(employeeId ? seatId : null);
      if (!layoutMode) {
        setColanOccupancySnapshot(null);
      }
    });
  };

  const runSwapSeats = async (
    fromSeatId: string,
    toSeatId: string,
    targetOfficeSlug = officeSlug,
  ) => {
    await withLoading("seating-assign", LOADING_PRESETS.assigningBay, async () => {
      await swapEmployeeBays(fromSeatId, toSeatId, targetOfficeSlug);
      setDialogSeat(null);
      setDialogCabinId(null);
      setSelectedSeat(toSeatId);
      if (!layoutMode) {
        setColanOccupancySnapshot(null);
      }
    });
  };

  const seatIdsForOffice = React.useCallback(
    (slug: string) => {
      if (slug === officeSlug) return planSeatIds;
      if (companionPlan && slug === companionPlan.slug) return companionPlan.seatIds;
      return planSeatIds;
    },
    [companionPlan, officeSlug, planSeatIds],
  );

  const occupancyForOffice = React.useCallback(
    (slug: string) =>
      seatOccupancyMap(employees, {
        officeSlug: slug,
        seatIds: seatIdsForOffice(slug),
      }),
    [employees, seatIdsForOffice],
  );

  const requestMoveSeat = React.useCallback(
    (toSeatId: string, employeeId: string, targetOfficeSlug = officeSlug) => {
      const occupancy = occupancyForOffice(targetOfficeSlug);
      let fromSeatId: string | null = null;
      let employeeName = "This employee";
      for (const [seatId, employee] of occupancy) {
        if (employee.id === employeeId) {
          fromSeatId = seatId;
          employeeName = employee.name;
          break;
        }
      }
      if (!fromSeatId || fromSeatId === toSeatId) return;
      if (occupancy.has(toSeatId)) return;

      setSeatTransferPending({
        kind: "move",
        fromSeatId,
        toSeatId,
        employeeId,
        employeeName,
        officeSlug: targetOfficeSlug,
      });
    },
    [occupancyForOffice, officeSlug],
  );

  const requestSwapSeats = React.useCallback(
    (fromSeatId: string, toSeatId: string, targetOfficeSlug = officeSlug) => {
      if (fromSeatId === toSeatId) return;
      const occupancy = occupancyForOffice(targetOfficeSlug);
      const fromEmployee = occupancy.get(fromSeatId);
      const toEmployee = occupancy.get(toSeatId);
      if (!fromEmployee || !toEmployee) return;

      setSeatTransferPending({
        kind: "swap",
        fromSeatId,
        toSeatId,
        fromEmployeeId: fromEmployee.id,
        fromEmployeeName: fromEmployee.name,
        toEmployeeId: toEmployee.id,
        toEmployeeName: toEmployee.name,
        officeSlug: targetOfficeSlug,
      });
    },
    [occupancyForOffice, officeSlug],
  );

  const confirmSeatTransfer = async () => {
    if (!seatTransferPending) return;
    const pending = seatTransferPending;
    try {
      if (pending.kind === "cabin-swap") {
        await withLoading("seating-assign", LOADING_PRESETS.assigningBay, async () => {
          const updated = await swapFloorPlanCabinsClient(
            pending.officeSlug,
            pending.fromCabinId,
            pending.toCabinId,
          );
          if (updated.slug === officeSlug) {
            setActivePlan(updated);
          } else if (companionPlan && updated.slug === companionPlan.slug) {
            setCompanionPlan(updated);
          }
          setSelectedCabinId(null);
          setDialogCabinId(null);
        });
      } else if (pending.kind === "swap") {
        await runSwapSeats(pending.fromSeatId, pending.toSeatId, pending.officeSlug);
      } else {
        await runAssign(pending.toSeatId, pending.employeeId, pending.officeSlug);
      }
      setSeatTransferPending(null);
    } catch {
      // Keep dialog open so the admin can cancel or retry after the error surfaces.
    }
  };

  const cabinLabelOnOffice = React.useCallback(
    (cabinId: string, targetOfficeSlug: string) => {
      const plan =
        targetOfficeSlug === officeSlug
          ? activePlan
          : companionPlan?.slug === targetOfficeSlug
            ? companionPlan
            : activePlan;
      if (!plan) return cabinId;
      return (
        listCabinSlotsOnPlan(plan).find((slot) => slot.id === cabinId)?.label ?? cabinId
      );
    },
    [activePlan, companionPlan, officeSlug],
  );

  const requestSwapCabins = React.useCallback(
    (fromCabinId: string, toCabinId: string, targetOfficeSlug = officeSlug) => {
      if (!fromCabinId || !toCabinId || fromCabinId === toCabinId) return;
      const occupancy = cabinOccupancyMap(employees, {
        officeSlug: targetOfficeSlug,
        cabinIds:
          targetOfficeSlug === officeSlug
            ? cabinIds
            : companionPlan
              ? listCabinSlotsOnPlan(companionPlan).map((s) => s.id)
              : cabinIds,
      });
      setSeatTransferPending({
        kind: "cabin-swap",
        fromCabinId,
        toCabinId,
        fromCabinLabel: cabinLabelOnOffice(fromCabinId, targetOfficeSlug),
        toCabinLabel: cabinLabelOnOffice(toCabinId, targetOfficeSlug),
        fromOccupantName: occupancy.get(fromCabinId)?.name ?? null,
        toOccupantName: occupancy.get(toCabinId)?.name ?? null,
        officeSlug: targetOfficeSlug,
      });
    },
    [
      cabinIds,
      cabinLabelOnOffice,
      companionPlan,
      employees,
      officeSlug,
    ],
  );

  const runAssignCabin = async (
    cabinId: string,
    employeeId: string | null,
    targetOfficeSlug = officeSlug,
  ) => {
    await withLoading("seating-assign", LOADING_PRESETS.assigningBay, async () => {
      await assignEmployeeToCabin(cabinId, employeeId, targetOfficeSlug);
      setDialogCabinId(null);
      setDialogSeat(null);
      setSelectedCabinId(employeeId ? cabinId : null);
      if (!layoutMode) {
        setColanOccupancySnapshot(null);
      }
    });
  };

  const runAssignCabinMembers = async (
    cabinId: string,
    employeeIds: string[],
    targetOfficeSlug = officeSlug,
  ) => {
    await withLoading("seating-assign", LOADING_PRESETS.assigningBay, async () => {
      await assignEmployeesToCabin(cabinId, employeeIds, targetOfficeSlug);
      setDialogCabinId(null);
      setDialogSeat(null);
      setSelectedCabinId(employeeIds.length > 0 ? cabinId : null);
      if (!layoutMode) {
        setColanOccupancySnapshot(null);
      }
    });
  };

  const freezeColanForLayout = React.useCallback(() => {
    setColanOccupancySnapshot(cloneOccupancyMap(savedOccupancy));
  }, [savedOccupancy]);

  const handleApplyColanPrompt = React.useCallback(
    async (prompt: string) => {
      await withLoading("seating-layout-edit", LOADING_PRESETS.seatingLayoutEdit, async () => {
        const result = await requestColanLayoutEdit({
          prompt,
          layout: buildColanLayoutState(),
        });

        setPromptRows(result.layout.rows);
        setPromptCabinsBeforeA(result.layout.cabinsBeforeA);
        setPromptCabinsAfterG(result.layout.cabinsAfterG);
        setPromptSideCabins(result.layout.sideCabins);
        setPromptSummary(result.summary);
        setPromptWarnings([...result.warnings, ...result.errors]);
        setPromptOccupancySwaps((previous) => [...previous, ...result.occupancySwaps]);
        setSelectedSeat(null);
        setDialogSeat(null);
        setAiSuggestion(null);
        setColanOccupancySnapshot(null);
        setAiPanelOpen(true);
        setViewMode("all");
      });
    },
    [buildColanLayoutState, setViewMode, withLoading],
  );

  const handleSeatClick = (seatId: string, targetOfficeSlug = officeSlug) => {
    if (layoutMode && layoutSeats && !layoutSeats.has(seatId)) return;
    if (promptLayoutActive) return;
    setSelectedSeat(seatId);
    setSelectedCabinId(null);
    setDialogCabinId(null);
    setDialogOfficeSlug(targetOfficeSlug);
    if (canAssign) setDialogSeat(seatId);
  };

  const handleCabinClick = (cabinId: string, targetOfficeSlug = officeSlug) => {
    if (layoutMode || promptLayoutActive) return;
    setSelectedCabinId(cabinId);
    setSelectedSeat(null);
    setDialogSeat(null);
    setDialogOfficeSlug(targetOfficeSlug);
    if (canAssign) {
      setDialogCabinId(cabinId);
      return;
    }
    // View-only: open when occupied on the clicked office.
    const slots =
      targetOfficeSlug === officeSlug
        ? cabinIds
        : companionPlan
          ? listCabinSlotsOnPlan(companionPlan).map((s) => s.id)
          : cabinIds;
    const occupied =
      (cabinOccupantsMap(employees, {
        officeSlug: targetOfficeSlug,
        cabinIds: slots,
      }).get(cabinId)?.length ?? 0) > 0;
    if (occupied) setDialogCabinId(cabinId);
  };

  const fullscreenBlocks = React.useMemo((): SeatingFullscreenBlock[] => {
    if (layoutMode) {
      return [
        {
          key: "layout",
          label: "Layout canvas",
          officeSlug,
          occupancy: displayOccupancy,
          rows: activeRows,
          showCabins: false,
        },
      ];
    }

    const toBlock = (plan: FloorPlanDTO, slug: string): SeatingFullscreenBlock => {
      const slots = listCabinSlotsOnPlan(plan);
      return {
        key: slug,
        label: `${plan.city ?? "Office"} · ${plan.building ?? plan.name}`,
        officeSlug: slug,
        occupancy: seatOccupancyMap(employees, {
          officeSlug: slug,
          seatIds: plan.seatIds,
        }),
        cabinOccupancy: cabinOccupancyMap(employees, {
          officeSlug: slug,
          cabinIds: slots.map((s) => s.id),
        }),
        cabinOccupants: cabinOccupantsMap(employees, {
          officeSlug: slug,
          cabinIds: slots.map((s) => s.id),
        }),
        rows: plan.rows,
        showCabins: true,
        cabinsBeforeA: plan.cabins?.beforeA ?? [],
        cabinsAfterG: plan.cabins?.afterG ?? [],
        sideCabins: plan.cabins?.sideCabins?.hrManager?.trim() ||
          plan.cabins?.sideCabins?.manager?.trim()
          ? plan.cabins.sideCabins!
          : EMPTY_SIDE_CABINS,
        outsideEntrance: plan.cabins?.outsideEntrance ?? null,
      };
    };

    if (activePlan && companionPlan) {
      const primary = toBlock(activePlan, activePlan.slug);
      const secondary = toBlock(companionPlan, companionPlan.slug);
      const ordered =
        activePlan.building === "Block B" || activePlan.slug.endsWith("-block-b")
          ? [secondary, primary]
          : [primary, secondary];
      return ordered.map((block) => ({
        ...block,
        label:
          block.officeSlug === activePlan.slug
            ? activePlan.name
            : companionPlan.name || blockLabelForPlan(companionPlan),
      }));
    }

    if (activePlan) {
      return [
        toBlock(
          activePlan,
          officeSlug,
        ),
      ];
    }

    return [
      {
        key: officeSlug,
        label: "Floor layout",
        officeSlug,
        occupancy: displayOccupancy,
        cabinOccupancy,
        cabinOccupants,
        rows: activeRows,
        showCabins: !layoutMode,
        cabinsBeforeA: activeCabinsBeforeA,
        cabinsAfterG: activeCabinsAfterG,
        sideCabins: activeSideCabins,
        outsideEntrance: activeOutsideEntrance,
      },
    ];
  }, [
    layoutMode,
    officeSlug,
    displayOccupancy,
    cabinOccupancy,
    cabinOccupants,
    activeRows,
    activePlan,
    companionPlan,
    employees,
    activeCabinsBeforeA,
    activeCabinsAfterG,
    activeSideCabins,
    activeOutsideEntrance,
  ]);

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

  const liveStats = React.useMemo(
    () =>
      computeSeatingStats(employees, {
        officeSlug,
        seatIds: planSeatIds,
      }),
    [employees, officeSlug, planSeatIds],
  );
  const orgStats = React.useMemo(
    () => aggregateAllBranchStats(officePlans, employees),
    [officePlans, employees],
  );
  const headerStats = listMode
    ? orgStats
    : layoutMode || colanFrozen
      ? stats
      : liveStats;

  const exportSeatIds = React.useMemo(() => {
    if (layoutMode && layoutSeats) return Array.from(layoutSeats);
    if (colanFrozen) return planSeatIds;
    if (promptLayoutActive) return activeSeatIds;
    return planSeatIds;
  }, [layoutMode, layoutSeats, colanFrozen, promptLayoutActive, activeSeatIds, planSeatIds]);

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
    const previousZoom = zoom;
    try {
      if (previousZoom !== 1) {
        setZoom(1);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        await new Promise<void>((resolve) => window.setTimeout(resolve, 240));
      }

      const dataUrl = await captureLayoutImage({
        canvas: floorPlanRef.current?.getLayoutCanvas() ?? null,
        element: floorPlanRef.current?.getFloorPlanElement() ?? null,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadDataUrl(`seating-layout-${stamp}.png`, dataUrl);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not export layout image.");
    } finally {
      if (previousZoom !== 1) {
        setZoom(previousZoom);
      }
    }
  }, [zoom]);

  const floorSectionTitle = layoutMode
    ? "New layout canvas"
    : promptLayoutActive
      ? `Edited ${activePlan?.name ?? "office"} layout`
      : null;

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {listMode ? (
            <>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                Seating arrangement
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Review occupancy by branch, then open a floor plan to assign seats.
              </p>
            </>
          ) : (
            <>
              {floorSectionTitle ? (
                <p className="text-sm font-semibold text-muted-foreground">{floorSectionTitle}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg px-2.5 text-xs"
                  onClick={backToBranchList}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All branches
                </Button>
              </div>
              <SeatingOfficeSelect
                plans={officePlans}
                value={officeSlug}
                onChange={selectOfficeSlug}
                disabled={planLoading || layoutMode || promptLayoutActive}
              />
            </>
          )}
        </div>

        {canAssign && (
          <div className="flex flex-wrap items-center justify-end gap-2 lg:pt-1">
            {!listMode && promptLayoutActive && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 gap-1.5 rounded-lg px-2.5 text-xs"
                onClick={resetPromptLayout}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to office
              </Button>
            )}
            {!listMode && layoutMode && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 gap-1.5 rounded-lg px-2.5 text-xs"
                onClick={clearAiLayout}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to office
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-sm"
              disabled={(!listMode && (planLoading || layoutMode || promptLayoutActive)) || plansLoading}
              asChild
            >
              <Link href="/seating/floors/new">
                <Plus className="h-3.5 w-3.5" />
                Create floor
              </Link>
            </Button>
            {!listMode && activePlan && !planLoading && !layoutMode && !promptLayoutActive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-sm"
                asChild
              >
                <Link href={`/seating/floors/${encodeURIComponent(officeSlug)}/edit`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit floor
                </Link>
              </Button>
            ) : !listMode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-sm"
                disabled
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit floor
              </Button>
            ) : null}
            {!listMode ? (
              <Button
                type="button"
                size="sm"
                className={cn(
                  "h-9 shrink-0 gap-1.5 rounded-lg border-0 px-3.5 text-xs font-semibold shadow-sm transition-colors",
                  "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md",
                  "focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2",
                  "dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500",
                  aiPanelOpen && "bg-blue-700 hover:bg-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600",
                )}
                onClick={() => setAiPanelOpen((open) => !open)}
              >
                <Sparkles className="h-3.5 w-3.5 text-white" />
                {aiPanelOpen ? "Close AI" : "AI generator"}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <SeatingAnalyticsOverview
        stats={headerStats}
        variant="dashboard"
        hideUtilization={listMode}
      />

      {listMode ? (
        <SeatingBranchList
          plans={officePlans}
          employees={employees}
          loading={plansLoading}
          onViewBranch={openBranchFloor}
        />
      ) : (
        <>
      <div className="rounded-2xl border border-slate-200 bg-slate-100/90 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] dark:border-border dark:bg-muted/40 sm:p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-muted-foreground">
            Search & floor tools
          </p>
        </div>
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <SeatingToolbar
            embedded
            hideZoom
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

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <SeatingZoomControls zoom={zoom} onZoomChange={setZoom} />

            {canAssign && colanFrozen && !layoutMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-slate-300 bg-white gap-1.5 px-2.5 text-xs font-semibold shadow-sm dark:border-border dark:bg-background"
                onClick={exitColanFrozenView}
              >
                Show live seating
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 rounded-xl border-slate-300 bg-white gap-1.5 px-3 text-xs font-semibold shadow-sm dark:border-border dark:bg-background",
                viewHintActive && "seating-view-hint border-primary/50",
              )}
              onClick={openFullscreenView}
              aria-label="Open full floor plan view"
            >
              <Expand className={cn("h-3.5 w-3.5", viewHintActive && "seating-view-hint-icon")} />
              View
            </Button>

            <SeatingDownloadMenu
              onExportImage={exportLayoutImage}
              onExportPdf={exportPdf}
              onExportExcel={exportCsv}
            />

            {layoutMode && (
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-800 dark:text-violet-200">
                Layout planner
              </span>
            )}
            {promptLayoutActive && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:text-emerald-200">
                Prompt layout
              </span>
            )}
            {colanFrozen && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200">
                Colan frozen
              </span>
            )}
          </div>
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-sm">
        {canAssign && aiPanelOpen && (
          <div className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-5">
            <SeatingAiPanel
              embedded
              open={aiPanelOpen}
              onOpenChange={setAiPanelOpen}
              loading={aiGenerating || layoutEditing}
              suggestion={aiSuggestion}
              onGenerateText={handleGenerateText}
              onGenerateImage={handleGenerateImage}
              onBackToColan={clearAiLayout}
              onApplyColanPrompt={handleApplyColanPrompt}
              colanPromptSummary={promptSummary}
              colanPromptWarnings={promptWarnings}
            />
          </div>
        )}

        <SeatingScrollViewport
          fitWidth
          paddingClassName="p-3 sm:p-5"
          className="bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.25)_100%)]"
        >
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
            cabinsBeforeA={activeCabinsBeforeA}
            cabinsAfterG={activeCabinsAfterG}
            sideCabins={activeSideCabins}
            outsideEntrance={activeOutsideEntrance}
            cabinOccupancy={cabinOccupancy}
            cabinOccupants={cabinOccupants}
            selectedCabinId={selectedCabinId}
            onCabinClick={handleCabinClick}
            onSeatClick={handleSeatClick}
            onAssignSeat={(seatId, employeeId) =>
              requestMoveSeat(seatId, employeeId)
            }
            onSwapSeats={(fromSeatId, toSeatId) =>
              requestSwapSeats(fromSeatId, toSeatId)
            }
            onSwapCabins={(fromCabinId, toCabinId) =>
              requestSwapCabins(fromCabinId, toCabinId)
            }
          />
        </SeatingScrollViewport>
      </section>

      {!canAssign && (
        <p className="shrink-0 text-sm text-muted-foreground">
          View-only mode. Admins and project leads can assign seats from this floor plan.
        </p>
      )}
        </>
      )}

      <SeatingFloorPlanFullscreen
        open={!listMode && fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        title={
          layoutMode
            ? "New layout canvas"
            : activePlan && companionPlan
              ? `${branchKeyForPlan(activePlan)} · Block A & Block B`
              : activePlan?.building
                ? `${activePlan.city ?? "Office"} · ${activePlan.building}`
                : activePlan?.name ?? "Floor layout"
        }
        subtitle={
          layoutMode
            ? "Desks from your AI prompt — assignments save immediately."
            : colanFrozen
              ? "Frozen Colan view from before the layout planner."
              : activePlan && companionPlan
                ? "Both office blocks · fitted to your screen · scroll down"
                : "Full layout fitted to your screen · scroll down for more rows"
        }
        blocks={fullscreenBlocks}
        selectedSeat={selectedSeat}
        selectedCabinId={selectedCabinId}
        highlightSeats={highlights}
        layoutMode={layoutMode}
        generatedLayout={aiSuggestion?.layout ?? null}
        layoutSeats={layoutSeats}
        layoutZones={layoutZones}
        zoneBySeat={zoneBySeat}
        teamFilter={teamFilter}
        search={search}
        viewMode={viewMode}
        canAssign={canAssign && !promptLayoutActive}
        onSeatClick={handleSeatClick}
        onCabinClick={handleCabinClick}
        onAssignSeat={(seatId, employeeId, slug) =>
          requestMoveSeat(seatId, employeeId, slug)
        }
        onSwapSeats={(fromSeatId, toSeatId, slug) =>
          requestSwapSeats(fromSeatId, toSeatId, slug)
        }
        onSwapCabins={(fromCabinId, toCabinId, slug) =>
          requestSwapCabins(fromCabinId, toCabinId, slug)
        }
      />

      <SeatingTransferConfirmDialog
        pending={listMode ? null : seatTransferPending}
        elevated={fullscreenOpen}
        loading={saving}
        onOpenChange={(open) => {
          if (!open && !saving) setSeatTransferPending(null);
        }}
        onConfirm={() => void confirmSeatTransfer()}
      />

      <SeatingAssignmentDialog
        open={!listMode && (!!dialogSeat || !!dialogCabinId)}
        seatId={dialogSeat}
        cabinId={dialogCabinId}
        cabinLabel={dialogCabinLabel}
        employees={employees}
        canAssign={canAssign}
        saving={saving}
        officeSlug={dialogOfficeSlug}
        elevated={fullscreenOpen}
        seatIds={
          dialogOfficeSlug === officeSlug
            ? planSeatIds
            : companionPlan?.seatIds ?? planSeatIds
        }
        cabinIds={
          dialogOfficeSlug === officeSlug
            ? cabinIds
            : companionPlan
              ? listCabinSlotsOnPlan(companionPlan).map((s) => s.id)
              : cabinIds
        }
        onClose={() => {
          setDialogSeat(null);
          setDialogCabinId(null);
        }}
        onAssign={(employeeId) => {
          if (dialogCabinId) {
            void runAssignCabin(dialogCabinId, employeeId, dialogOfficeSlug);
            return;
          }
          if (!dialogSeat) return;
          void runAssign(dialogSeat, employeeId, dialogOfficeSlug);
        }}
        onAssignMany={(employeeIds) => {
          if (!dialogCabinId) return;
          void runAssignCabinMembers(dialogCabinId, employeeIds, dialogOfficeSlug);
        }}
        onRemove={() => {
          if (dialogCabinId) {
            void runAssignCabinMembers(dialogCabinId, [], dialogOfficeSlug);
            return;
          }
          if (!dialogSeat) return;
          void runAssign(dialogSeat, null, dialogOfficeSlug);
        }}
        onReassign={(targetId) => {
          if (dialogCabinId) {
            const map = cabinOccupancyMap(employees, {
              officeSlug: dialogOfficeSlug,
              cabinIds:
                dialogOfficeSlug === officeSlug
                  ? cabinIds
                  : companionPlan
                    ? listCabinSlotsOnPlan(companionPlan).map((s) => s.id)
                    : cabinIds,
            });
            const emp = map.get(dialogCabinId) ?? null;
            if (!emp) return;
            void runAssignCabin(targetId, emp.id, dialogOfficeSlug);
            return;
          }
          const map = seatOccupancyMap(employees, {
            officeSlug: dialogOfficeSlug,
            seatIds:
              dialogOfficeSlug === officeSlug
                ? planSeatIds
                : companionPlan?.seatIds ?? planSeatIds,
          });
          const emp = dialogSeat ? map.get(dialogSeat) ?? null : null;
          if (!emp || !dialogSeat) return;
          setDialogSeat(null);
          setDialogCabinId(null);
          requestMoveSeat(targetId, emp.id, dialogOfficeSlug);
        }}
      />
    </div>
  );
}
