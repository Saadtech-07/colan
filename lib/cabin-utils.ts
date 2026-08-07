import type { FloorPlanDTO } from "@/models/floor-plan.model";
import type { SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";
import { employeeEligibleForSeating } from "@/lib/workspace-identity";
import type { Employee } from "@/types";

export type CabinSlot = {
  id: string;
  label: string;
  kind: "beforeA" | "afterG" | "side";
};

export function sideCabinSlots(side?: SideCabinsConfig | null): CabinSlot[] {
  if (!side) return [];
  const slots: CabinSlot[] = [];
  const top = side.hrManager?.trim() ?? "";
  const bottom = side.manager?.trim() ?? "";
  if (top) {
    slots.push({
      id: (side.hrManagerId ?? "side-hr-manager").trim() || "side-hr-manager",
      label: top,
      kind: "side",
    });
  }
  if (bottom) {
    slots.push({
      id: (side.managerId ?? "side-manager").trim() || "side-manager",
      label: bottom,
      kind: "side",
    });
  }
  return slots;
}

export function listCabinSlotsOnPlan(plan: FloorPlanDTO): CabinSlot[] {
  const before = (plan.cabins?.beforeA ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    kind: "beforeA" as const,
  }));
  const after = (plan.cabins?.afterG ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    kind: "afterG" as const,
  }));
  return [...before, ...sideCabinSlots(plan.cabins?.sideCabins), ...after];
}

export function isCabinOnPlan(cabinId: string, plan: FloorPlanDTO): boolean {
  const id = cabinId.trim();
  if (!id) return false;
  return listCabinSlotsOnPlan(plan).some((slot) => slot.id === id);
}

/** Cabins whose label ends with "Team" (HR Team, Sales Team, …) hold multiple people. */
export function isTeamCabinLabel(label?: string | null): boolean {
  return /\bteam\s*$/i.test((label ?? "").trim());
}

/** All occupants per cabin (ordered by name). */
export function cabinOccupantsMap(
  employees: Employee[],
  opts?: { officeSlug?: string; cabinIds?: string[] },
): Map<string, Employee[]> {
  const office = normalizeOfficeSlug(opts?.officeSlug);
  const cabinSet = opts?.cabinIds ? new Set(opts.cabinIds) : null;
  const map = new Map<string, Employee[]>();
  for (const emp of employees) {
    if (!employeeEligibleForSeating(emp)) continue;
    const cabinId = emp.cabinId?.trim();
    if (!cabinId) continue;
    if (normalizeOfficeSlug(emp.officeSlug) !== office) continue;
    if (cabinSet && !cabinSet.has(cabinId)) continue;
    const list = map.get(cabinId) ?? [];
    list.push(emp);
    map.set(cabinId, list);
  }
  for (const [key, list] of map) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    map.set(key, list);
  }
  return map;
}

export function cabinOccupancyMap(
  employees: Employee[],
  opts?: { officeSlug?: string; cabinIds?: string[] },
): Map<string, Employee> {
  const multi = cabinOccupantsMap(employees, opts);
  const map = new Map<string, Employee>();
  for (const [cabinId, list] of multi) {
    if (list[0]) map.set(cabinId, list[0]);
  }
  return map;
}

type CabinLayout = NonNullable<FloorPlanDTO["cabins"]>;

type CabinLocation =
  | { region: "beforeA"; index: number }
  | { region: "afterG"; index: number }
  | { region: "side"; slot: "hrManager" | "manager" };

type CabinIdentity = { id: string; label: string };

function findCabinLocation(cabins: CabinLayout, cabinId: string): CabinLocation | null {
  const id = cabinId.trim();
  if (!id) return null;

  const beforeIdx = (cabins.beforeA ?? []).findIndex((c) => c.id === id);
  if (beforeIdx >= 0) return { region: "beforeA", index: beforeIdx };

  const afterIdx = (cabins.afterG ?? []).findIndex((c) => c.id === id);
  if (afterIdx >= 0) return { region: "afterG", index: afterIdx };

  const side = cabins.sideCabins;
  if (side) {
    const topId = (side.hrManagerId ?? "side-hr-manager").trim() || "side-hr-manager";
    const bottomId = (side.managerId ?? "side-manager").trim() || "side-manager";
    if (topId === id) return { region: "side", slot: "hrManager" };
    if (bottomId === id) return { region: "side", slot: "manager" };
  }

  return null;
}

function readCabinIdentity(cabins: CabinLayout, loc: CabinLocation): CabinIdentity {
  if (loc.region === "beforeA") {
    const cabin = cabins.beforeA[loc.index];
    return { id: cabin.id, label: cabin.label };
  }
  if (loc.region === "afterG") {
    const cabin = cabins.afterG[loc.index];
    return { id: cabin.id, label: cabin.label };
  }
  const side = cabins.sideCabins!;
  if (loc.slot === "hrManager") {
    return {
      id: (side.hrManagerId ?? "side-hr-manager").trim() || "side-hr-manager",
      label: side.hrManager,
    };
  }
  return {
    id: (side.managerId ?? "side-manager").trim() || "side-manager",
    label: side.manager,
  };
}

function writeCabinIdentity(
  cabins: CabinLayout,
  loc: CabinLocation,
  identity: CabinIdentity,
): void {
  if (loc.region === "beforeA") {
    cabins.beforeA[loc.index] = {
      ...cabins.beforeA[loc.index],
      id: identity.id,
      label: identity.label,
      placement: "before-A",
    };
    return;
  }
  if (loc.region === "afterG") {
    cabins.afterG[loc.index] = {
      ...cabins.afterG[loc.index],
      id: identity.id,
      label: identity.label,
      placement: "after-G",
    };
    return;
  }
  const side = cabins.sideCabins!;
  if (loc.slot === "hrManager") {
    side.hrManager = identity.label;
    side.hrManagerId = identity.id;
    return;
  }
  side.manager = identity.label;
  side.managerId = identity.id;
}

/**
 * Swap two cabin identities (name + stable id) between physical slots.
 * Slot sizes stay put — content resizes to the destination slot.
 * Occupants follow cabin ids automatically.
 */
export function swapCabinIdentitiesInLayout(
  cabins: CabinLayout,
  cabinIdA: string,
  cabinIdB: string,
): CabinLayout {
  const next = structuredClone(cabins);
  next.beforeA = [...(next.beforeA ?? [])];
  next.afterG = [...(next.afterG ?? [])];
  if (next.sideCabins) next.sideCabins = { ...next.sideCabins };

  const locA = findCabinLocation(next, cabinIdA);
  const locB = findCabinLocation(next, cabinIdB);
  if (!locA || !locB) {
    throw new Error("One or both cabins were not found on this floor plan");
  }
  if (
    locA.region === locB.region &&
    (("index" in locA && "index" in locB && locA.index === locB.index) ||
      ("slot" in locA && "slot" in locB && locA.slot === locB.slot))
  ) {
    return next;
  }

  const identityA = readCabinIdentity(next, locA);
  const identityB = readCabinIdentity(next, locB);
  writeCabinIdentity(next, locA, identityB);
  writeCabinIdentity(next, locB, identityA);
  return next;
}
