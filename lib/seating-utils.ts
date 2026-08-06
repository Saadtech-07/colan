import { ALL_SEAT_IDS, isValidSeatId } from "@/lib/seating-layout";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";
import { employeeMatchesRoleFilter } from "@/lib/team-members-ui";
import { teamTabLabel } from "@/lib/team-utils";
import { employeeEligibleForSeating } from "@/lib/workspace-identity";
import type { WorkspaceRole } from "@/models";
import type { Employee, Gender, TeamName } from "@/types";

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
