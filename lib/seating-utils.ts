import { ALL_SEAT_IDS, isValidSeatId } from "@/lib/seating-layout";
import {
  blockLabelForPlan,
  branchKeyForPlan,
} from "@/lib/floor-plan-branch";
import { isChennaiOfficeSlug, normalizeOfficeSlug } from "@/lib/floor-plan-layouts";
import { employeeMatchesRoleFilter } from "@/lib/team-members-ui";
import { teamTabLabel } from "@/lib/team-utils";
import { employeeEligibleForSeating } from "@/lib/workspace-identity";
import type { FloorPlanSummary } from "@/models/floor-plan.model";
import type { WorkspaceRole } from "@/models";
import type { Employee, Gender, TeamName } from "@/types";

type FloorPlanBranchRef = Pick<FloorPlanSummary, "slug" | "name" | "city" | "building">;

function planForOfficeSlug(
  slug: string | null | undefined,
  plans: ReadonlyArray<FloorPlanBranchRef>,
): FloorPlanBranchRef | undefined {
  const normalized = normalizeOfficeSlug(slug);
  return plans.find((p) => normalizeOfficeSlug(p.slug) === normalized);
}

function branchPlansForSlug(
  slug: string | null | undefined,
  plans: ReadonlyArray<FloorPlanBranchRef>,
): FloorPlanBranchRef[] {
  const branchKey = seatingBranchKeyForSlug(slug, plans);
  return plans.filter(
    (p) => branchKeyForPlan(p).toLowerCase() === branchKey.toLowerCase(),
  );
}

/** Human-readable assignment: "Chennai Block A - C5" or "Bangalore - C5". */
export function formatEmployeeSeatingLocation(
  emp: Employee,
  plans: ReadonlyArray<FloorPlanBranchRef> = [],
  opts?: { cabinLabels?: ReadonlyMap<string, string> | Record<string, string> },
): string | null {
  const bay = emp.bayNumber?.trim();
  const cabinId = emp.cabinId?.trim();
  if (!bay && !cabinId) return null;

  const branchKey = seatingBranchKeyForSlug(emp.officeSlug, plans);
  const plan = planForOfficeSlug(emp.officeSlug, plans);
  const siblingPlans = branchPlansForSlug(emp.officeSlug, plans);
  const multiBlock = siblingPlans.length > 1;

  const cabinLabels = opts?.cabinLabels;
  let cabinLabel: string | undefined;
  if (cabinId && cabinLabels) {
    cabinLabel =
      cabinLabels instanceof Map
        ? cabinLabels.get(cabinId)
        : (cabinLabels as Record<string, string>)[cabinId];
  }

  const slotLabel = cabinId
    ? cabinLabel?.trim() ||
      cabinId.replace(/^cabin[-_]?/i, "").replace(/[-_]+/g, " ").trim() ||
      cabinId
    : bay!;

  if (multiBlock && plan) {
    const block = blockLabelForPlan(plan);
    return `${branchKey} ${block} - ${slotLabel}`;
  }
  return `${branchKey} - ${slotLabel}`;
}

/** Branch key for an office slug (Chennai Block A/B share "Chennai"). */
export function seatingBranchKeyForSlug(
  slug: string | null | undefined,
  plans: ReadonlyArray<FloorPlanBranchRef> = [],
): string {
  const normalized = normalizeOfficeSlug(slug);
  const plan = plans.find((p) => normalizeOfficeSlug(p.slug) === normalized);
  if (plan) return branchKeyForPlan(plan);
  if (isChennaiOfficeSlug(normalized)) return "Chennai";
  return normalized;
}

function branchesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
  plans: ReadonlyArray<FloorPlanBranchRef>,
): boolean {
  return (
    seatingBranchKeyForSlug(left, plans).toLowerCase() ===
    seatingBranchKeyForSlug(right, plans).toLowerCase()
  );
}

/** True when the employee holds a seat/cabin in a different branch than the target office. */
export function employeeSeatedInOtherBranch(
  emp: Employee,
  targetOfficeSlug: string | null | undefined,
  plans: ReadonlyArray<FloorPlanBranchRef> = [],
): boolean {
  const bay = emp.bayNumber?.trim();
  const cabin = emp.cabinId?.trim();
  if (!bay && !cabin) return false;
  return !branchesMatch(emp.officeSlug, targetOfficeSlug, plans);
}

/** True when the employee already occupies a seat or cabin in the target branch. */
export function employeeOccupiesBranch(
  emp: Employee,
  targetOfficeSlug: string | null | undefined,
  plans: ReadonlyArray<FloorPlanBranchRef> = [],
): boolean {
  const bay = emp.bayNumber?.trim();
  const cabin = emp.cabinId?.trim();
  if (!bay && !cabin) return false;
  return branchesMatch(emp.officeSlug, targetOfficeSlug, plans);
}

/**
 * Vacant-slot picker: show unassigned people plus people seated in other branches.
 * Hide people who already hold a seat/cabin in the same branch.
 */
export function employeeSelectableForVacantSlot(
  emp: Employee,
  targetOfficeSlug: string | null | undefined,
  plans: ReadonlyArray<FloorPlanBranchRef> = [],
  opts?: { allowCabinId?: string | null },
): boolean {
  const allowCabin = opts?.allowCabinId?.trim();
  if (
    allowCabin &&
    emp.cabinId?.trim() === allowCabin &&
    branchesMatch(emp.officeSlug, targetOfficeSlug, plans)
  ) {
    return true;
  }
  return !employeeOccupiesBranch(emp, targetOfficeSlug, plans);
}

export function employeeMatchesGenderFilter(emp: Employee, gender: string): boolean {
  if (!gender || gender === "all") return true;
  return (emp.gender ?? "male") === (gender as Gender);
}

const TEAM_PALETTE = [
  { bg: "bg-sky-500/20", border: "border-sky-500/50", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  { bg: "bg-emerald-500/20", border: "border-emerald-500/50", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { bg: "bg-violet-500/20", border: "border-violet-500/50", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { bg: "bg-amber-500/20", border: "border-amber-500/50", text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  { bg: "bg-rose-500/20", border: "border-rose-500/50", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  { bg: "bg-cyan-500/20", border: "border-cyan-500/50", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  { bg: "bg-orange-500/20", border: "border-orange-500/50", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  { bg: "bg-fuchsia-500/20", border: "border-fuchsia-500/50", text: "text-fuchsia-700 dark:text-fuchsia-300", dot: "bg-fuchsia-500" },
];

export function teamColorClasses(team: TeamName) {
  let hash = 0;
  for (let i = 0; i < team.length; i++) hash = team.charCodeAt(i) + ((hash << 5) - hash);
  return TEAM_PALETTE[Math.abs(hash) % TEAM_PALETTE.length];
}

export function seatOccupancyMap(
  employees: Employee[],
  opts?: { officeSlug?: string; seatIds?: string[] },
): Map<string, Employee> {
  const office = normalizeOfficeSlug(opts?.officeSlug);
  const seatSet = opts?.seatIds ? new Set(opts.seatIds) : null;
  const map = new Map<string, Employee>();
  for (const emp of employees) {
    if (!employeeEligibleForSeating(emp)) continue;
    if (!emp.bayNumber) continue;
    if (normalizeOfficeSlug(emp.officeSlug) !== office) continue;
    if (seatSet) {
      if (!seatSet.has(emp.bayNumber)) continue;
    } else if (!isValidSeatId(emp.bayNumber)) {
      continue;
    }
    if (!map.has(emp.bayNumber)) {
      map.set(emp.bayNumber, emp);
    }
  }
  return map;
}

export type SeatingStats = {
  total: number;
  occupied: number;
  empty: number;
  legacyUnassigned: number;
};

export function computeSeatingStats(
  employees: Employee[],
  opts?: { officeSlug?: string; seatIds?: string[] },
): SeatingStats {
  const seatIds = opts?.seatIds ?? ALL_SEAT_IDS;
  const map = seatOccupancyMap(employees, {
    officeSlug: opts?.officeSlug,
    seatIds,
  });
  const office = normalizeOfficeSlug(opts?.officeSlug);
  const legacyUnassigned = employees.filter((e) => {
    if (!employeeEligibleForSeating(e) || !e.bayNumber) return false;
    if (normalizeOfficeSlug(e.officeSlug) !== office) return false;
    return !seatIds.includes(e.bayNumber);
  }).length;
  return {
    total: seatIds.length,
    occupied: map.size,
    empty: seatIds.length - map.size,
    legacyUnassigned,
  };
}

export function employeeMatchesSearch(emp: Employee, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    emp.name.toLowerCase().includes(q) ||
    emp.employeeId.toLowerCase().includes(q) ||
    emp.bayNumber.toLowerCase().includes(q)
  );
}

export function highlightedSeatIds(
  employees: Employee[],
  opts: {
    team?: string;
    search?: string;
    role?: string;
    gender?: string;
    officeSlug?: string;
    seatIds?: string[];
  },
  workspaceRoles: WorkspaceRole[] = [],
): Set<string> | null {
  const {
    team,
    search = "",
    role = "all",
    gender = "all",
    officeSlug,
    seatIds,
  } = opts;
  const hasRoleFilter = role !== "all";
  const hasGenderFilter = gender !== "all";
  if (!search.trim() && (!team || team === "All") && !hasRoleFilter && !hasGenderFilter) {
    return null;
  }
  const office = normalizeOfficeSlug(officeSlug);
  const seatSet = seatIds ? new Set(seatIds) : null;
  const ids = new Set<string>();
  for (const emp of employees) {
    if (!employeeEligibleForSeating(emp)) continue;
    if (!emp.bayNumber) continue;
    if (normalizeOfficeSlug(emp.officeSlug) !== office) continue;
    if (seatSet) {
      if (!seatSet.has(emp.bayNumber)) continue;
    } else if (!isValidSeatId(emp.bayNumber)) {
      continue;
    }
    if (team && team !== "All" && emp.team !== team) continue;
    if (hasRoleFilter && !employeeMatchesRoleFilter(emp, role, workspaceRoles)) continue;
    if (!employeeMatchesGenderFilter(emp, gender)) continue;
    if (search && !employeeMatchesSearch(emp, search)) continue;
    ids.add(emp.bayNumber);
  }
  return ids;
}

export function teamLegendItems(teamNames: string[]) {
  return teamNames.map((team) => ({
    team,
    label: teamTabLabel(team),
    colors: teamColorClasses(team),
  }));
}
