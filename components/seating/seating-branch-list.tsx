"use client";

import * as React from "react";
import { Armchair, DoorOpen, Eye, LayoutGrid, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  blockLabelForPlan,
  groupFloorPlansByBranch,
  type FloorPlanBranchGroup,
} from "@/lib/floor-plan-branch";
import { cabinOccupantsMap, listCabinSlotsOnPlan } from "@/lib/cabin-utils";
import { fetchFloorPlanDetail } from "@/lib/floor-plans-client";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";
import type { SeatingStats } from "@/lib/seating-utils";
import { employeeEligibleForSeating } from "@/lib/workspace-identity";
import type { FloorPlanSummary } from "@/models/floor-plan.model";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

export type BranchSeatingRow = {
  key: string;
  label: string;
  plans: FloorPlanSummary[];
  primarySlug: string;
  blockLabels: string[];
  stats: SeatingStats;
};

type CabinAssignmentRow = {
  cabinId: string;
  label: string;
  blockLabel: string;
  officeSlug: string;
  occupants: Employee[];
};

function statsForPlan(employees: Employee[], plan: FloorPlanSummary): SeatingStats {
  const office = normalizeOfficeSlug(plan.slug);
  const seen = new Set<string>();
  for (const emp of employees) {
    if (!employeeEligibleForSeating(emp)) continue;
    if (normalizeOfficeSlug(emp.officeSlug) !== office) continue;
    const bay = emp.bayNumber?.trim();
    if (!bay) continue;
    seen.add(bay);
  }
  const occupied = Math.min(seen.size, plan.seatCount);
  return {
    total: plan.seatCount,
    occupied,
    empty: Math.max(0, plan.seatCount - occupied),
    legacyUnassigned: 0,
  };
}

/** Aggregate bay stats for one branch (all blocks). */
export function buildBranchSeatingRows(
  plans: FloorPlanSummary[],
  employees: Employee[],
): BranchSeatingRow[] {
  return groupFloorPlansByBranch(plans).map((branch: FloorPlanBranchGroup) => {
    const perPlan = branch.plans.map((plan) => statsForPlan(employees, plan));
    const stats: SeatingStats = {
      total: perPlan.reduce((n, s) => n + s.total, 0),
      occupied: perPlan.reduce((n, s) => n + s.occupied, 0),
      empty: perPlan.reduce((n, s) => n + s.empty, 0),
      legacyUnassigned: 0,
    };
    const primary =
      branch.plans.find((p) => p.building === "Block A") ?? branch.plans[0]!;
    return {
      key: branch.key,
      label: branch.label,
      plans: branch.plans,
      primarySlug: primary.slug,
      blockLabels: branch.plans.map((p) => blockLabelForPlan(p)),
      stats,
    };
  });
}

/** Org-wide totals across every floor plan summary. */
export function aggregateAllBranchStats(
  plans: FloorPlanSummary[],
  employees: Employee[],
): SeatingStats {
  const rows = buildBranchSeatingRows(plans, employees);
  return {
    total: rows.reduce((n, r) => n + r.stats.total, 0),
    occupied: rows.reduce((n, r) => n + r.stats.occupied, 0),
    empty: rows.reduce((n, r) => n + r.stats.empty, 0),
    legacyUnassigned: 0,
  };
}

async function loadBranchCabinAssignments(
  plans: FloorPlanSummary[],
  employees: Employee[],
): Promise<CabinAssignmentRow[]> {
  const details = await Promise.all(
    plans.map((plan) => fetchFloorPlanDetail(plan.slug)),
  );
  const rows: CabinAssignmentRow[] = [];
  for (const plan of details) {
    if (!plan) continue;
    const slots = listCabinSlotsOnPlan(plan);
    const occupants = cabinOccupantsMap(employees, {
      officeSlug: plan.slug,
      cabinIds: slots.map((s) => s.id),
    });
    for (const slot of slots) {
      rows.push({
        cabinId: slot.id,
        label: slot.label,
        blockLabel: blockLabelForPlan(plan),
        officeSlug: plan.slug,
        occupants: occupants.get(slot.id) ?? [],
      });
    }
  }
  return rows;
}

type Props = {
  plans: FloorPlanSummary[];
  employees: Employee[];
  loading?: boolean;
  onViewBranch: (officeSlug: string) => void;
};

export function SeatingBranchList({
  plans,
  employees,
  loading = false,
  onViewBranch,
}: Props) {
  const rows = React.useMemo(
    () => buildBranchSeatingRows(plans, employees),
    [plans, employees],
  );

  const [cabinsBranchKey, setCabinsBranchKey] = React.useState<string | null>(null);
  const [cabinRows, setCabinRows] = React.useState<CabinAssignmentRow[]>([]);
  const [cabinsLoading, setCabinsLoading] = React.useState(false);
  const [cabinsError, setCabinsError] = React.useState<string | null>(null);

  const activeCabinsBranch = rows.find((r) => r.key === cabinsBranchKey) ?? null;

  const openCabins = React.useCallback(
    async (row: BranchSeatingRow) => {
      setCabinsBranchKey(row.key);
      setCabinsLoading(true);
      setCabinsError(null);
      setCabinRows([]);
      try {
        const next = await loadBranchCabinAssignments(row.plans, employees);
        setCabinRows(next);
      } catch (e) {
        setCabinsError(e instanceof Error ? e.message : "Could not load cabins.");
      } finally {
        setCabinsLoading(false);
      }
    },
    [employees],
  );

  if (loading && plans.length === 0) {
    return (
      <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-10 text-center text-sm text-muted-foreground">
        Loading branches…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        No branches yet. Create a floor to get started.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          All branches
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
          Seating by branch
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Occupancy across every office. Open cabins or a floor plan per branch.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background/80 shadow-sm">
        <div className="md:min-w-[42rem]">
        <div
          className={cn(
            "hidden border-b border-border/60 bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid md:items-center md:gap-4",
            BRANCH_ROW_GRID,
          )}
        >
          <span>Branch</span>
          <span className="text-center">Total</span>
          <span className="text-center">Occupied</span>
          <span className="text-center">Available</span>
          <span className="text-right">Action</span>
        </div>

        <ul className="divide-y divide-border/60">
          {rows.map((row) => (
            <li
              key={row.key}
              className={cn(
                "grid grid-cols-1 gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30",
                "md:items-center md:gap-4",
                BRANCH_ROW_GRID,
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/50">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {row.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.blockLabels.join(" · ")}
                      {row.plans.length > 1 ? ` · ${row.plans.length} blocks` : ""}
                    </p>
                  </div>
                </div>
              </div>

              <StatCell icon={LayoutGrid} label="Total" value={row.stats.total} />
              <StatCell
                icon={Users}
                label="Occupied"
                value={row.stats.occupied}
                valueClassName="text-emerald-700 dark:text-emerald-300"
              />
              <StatCell
                icon={Armchair}
                label="Available"
                value={row.stats.empty}
                valueClassName="text-amber-700 dark:text-amber-300"
              />

              <div className="flex items-center justify-stretch gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-[5.75rem] flex-1 gap-1.5 rounded-xl px-3 text-xs font-semibold sm:flex-none"
                  onClick={() => void openCabins(row)}
                >
                  <DoorOpen className="h-3.5 w-3.5" />
                  Cabins
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 min-w-[5.75rem] flex-1 gap-1.5 rounded-xl px-3 text-xs font-semibold sm:flex-none"
                  onClick={() => onViewBranch(row.primarySlug)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
              </div>
            </li>
          ))}
        </ul>
        </div>
      </div>

      <Dialog
        open={cabinsBranchKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCabinsBranchKey(null);
            setCabinRows([]);
            setCabinsError(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {activeCabinsBranch
                ? `${activeCabinsBranch.label} cabins`
                : "Branch cabins"}
            </DialogTitle>
            <DialogDescription>
              Cabin assignments for this branch. Vacant cabins show as available.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto pr-1">
            {cabinsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading cabins…
              </p>
            ) : cabinsError ? (
              <p className="py-8 text-center text-sm text-destructive">{cabinsError}</p>
            ) : cabinRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No cabins on this branch yet.
              </p>
            ) : (
              cabinRows.map((cabin) => {
                const names = cabin.occupants.map((e) => e.name.trim()).filter(Boolean);
                return (
                  <div
                    key={`${cabin.officeSlug}:${cabin.cabinId}`}
                    className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {cabin.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {cabin.blockLabel}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          names.length > 0
                            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                            : "bg-amber-500/15 text-amber-800 dark:text-amber-200",
                        )}
                      >
                        {names.length > 0 ? `${names.length} assigned` : "Vacant"}
                      </span>
                    </div>
                    {names.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {names.map((name) => (
                          <li
                            key={name}
                            className="text-xs font-medium text-foreground"
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        No employees assigned
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Shared desktop columns so headers and row values stay aligned. */
const BRANCH_ROW_GRID =
  "md:grid-cols-[minmax(0,1.6fr)_5.5rem_5.5rem_5.5rem_minmax(12.5rem,auto)]";

function StatCell({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 md:block md:text-center">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground md:hidden">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums text-foreground md:text-center",
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}
