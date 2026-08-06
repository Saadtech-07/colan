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

export function cabinOccupancyMap(
  employees: Employee[],
  opts?: { officeSlug?: string; cabinIds?: string[] },
): Map<string, Employee> {
  const office = normalizeOfficeSlug(opts?.officeSlug);
  const cabinSet = opts?.cabinIds ? new Set(opts.cabinIds) : null;
  const map = new Map<string, Employee>();
  for (const emp of employees) {
    if (!employeeEligibleForSeating(emp)) continue;
    const cabinId = emp.cabinId?.trim();
    if (!cabinId) continue;
    if (normalizeOfficeSlug(emp.officeSlug) !== office) continue;
    if (cabinSet && !cabinSet.has(cabinId)) continue;
    if (!map.has(cabinId)) map.set(cabinId, emp);
  }
  return map;
}
