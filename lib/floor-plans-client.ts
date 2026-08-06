import { dedupeAsync } from "@/lib/dedupe-async";
import type { FloorPlanDTO, FloorPlanSummary } from "@/models/floor-plan.model";

let summaryCache: FloorPlanSummary[] | null = null;
const detailCache = new Map<string, FloorPlanDTO>();

export async function fetchFloorPlanSummaries(opts?: {
  force?: boolean;
}): Promise<FloorPlanSummary[]> {
  if (!opts?.force && summaryCache) return summaryCache;

  return dedupeAsync("floor-plans:list", async () => {
    const res = await fetch("/api/floor-plans", { credentials: "include" });
    if (!res.ok) {
      throw new Error(`Failed to load floor plans (${res.status})`);
    }
    const plans = (await res.json()) as FloorPlanSummary[];
    summaryCache = plans;
    return plans;
  });
}

export async function fetchFloorPlanDetail(
  slug: string,
  opts?: { force?: boolean },
): Promise<FloorPlanDTO | null> {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  if (!opts?.force && detailCache.has(key)) {
    return detailCache.get(key) ?? null;
  }

  return dedupeAsync(`floor-plans:detail:${key}`, async () => {
    const res = await fetch(`/api/floor-plans/${encodeURIComponent(key)}`, {
      credentials: "include",
    });
    if (res.status === 404) {
      detailCache.delete(key);
      return null;
    }
    if (!res.ok) {
      throw new Error(`Failed to load floor plan (${res.status})`);
    }
    const plan = (await res.json()) as FloorPlanDTO;
    detailCache.set(key, plan);
    return plan;
  });
}

export function invalidateFloorPlanClientCache(slug?: string) {
  if (!slug) {
    summaryCache = null;
    detailCache.clear();
    return;
  }
  detailCache.delete(slug.trim().toLowerCase());
  summaryCache = null;
}
