import {
  CHENNAI_BLOCK_A_SLUG,
  CHENNAI_BLOCK_B_SLUG,
  isChennaiOfficeSlug,
} from "@/lib/floor-plan-layouts";
import { slugifyFloorPlanSlug } from "@/lib/floor-plan-row-builder";
import type { FloorPlanSummary } from "@/models/floor-plan.model";

export type FloorPlanBranchGroup = {
  key: string;
  label: string;
  plans: FloorPlanSummary[];
};

/** Prefer city; fall back to name prefix before "·" / "-". */
export function branchKeyForPlan(plan: Pick<FloorPlanSummary, "slug" | "name" | "city">): string {
  if (isChennaiOfficeSlug(plan.slug)) return "Chennai";
  const city = plan.city?.trim();
  if (city) return city;
  const name = plan.name?.trim() || "Office";
  const cut = name.split(/\s*[·|–—-]\s*/)[0]?.trim();
  return cut || name;
}

export function groupFloorPlansByBranch(plans: FloorPlanSummary[]): FloorPlanBranchGroup[] {
  const order: string[] = [];
  const map = new Map<string, FloorPlanSummary[]>();

  for (const plan of plans) {
    const key = branchKeyForPlan(plan);
    let group = map.get(key);
    if (!group) {
      group = [];
      map.set(key, group);
      order.push(key);
    }
    group.push(plan);
  }

  return order.map((key) => ({
    key,
    label: key,
    plans: (map.get(key) ?? [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  }));
}

export function blockLabelForPlan(plan: Pick<FloorPlanSummary, "slug" | "building" | "name">): string {
  const building = plan.building?.trim();
  if (building) return building;
  if (plan.slug === CHENNAI_BLOCK_A_SLUG) return "Block A";
  if (plan.slug === CHENNAI_BLOCK_B_SLUG) return "Block B";
  if (/block\s*[a-z0-9]+/i.test(plan.name)) {
    const match = plan.name.match(/block\s*[a-z0-9]+/i);
    if (match) return match[0].replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "Floor plan";
}

/** Suggest display name from city + building, e.g. "Hyderabad · Block C". */
export function composeFloorPlanDisplayName(city: string, building: string, fallback = ""): string {
  const c = city.trim();
  const b = building.trim();
  if (c && b) return `${c} · ${b}`;
  if (c) return c;
  if (b) return b;
  return fallback.trim();
}

/** Suggest slug from city + building, e.g. hyderabad-block-c. */
export function composeFloorPlanSlug(city: string, building: string, fallbackSlug = ""): string {
  const cityPart = slugifyFloorPlanSlug(city);
  const buildingPart = slugifyFloorPlanSlug(building);
  if (cityPart && buildingPart) return `${cityPart}-${buildingPart}`.slice(0, 64);
  if (cityPart) return cityPart.slice(0, 64);
  if (buildingPart) return buildingPart.slice(0, 64);
  return slugifyFloorPlanSlug(fallbackSlug).slice(0, 64);
}
