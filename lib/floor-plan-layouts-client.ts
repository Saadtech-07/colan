import type { FloorPlanLayoutDTO } from "@/models/floor-plan-layout.model";
import { parseApiError } from "@/providers/app-state";

const layoutCache = new Map<string, FloorPlanLayoutDTO>();

async function fetchFloorPlanLayoutByStatus(
  slug: string,
  status: "draft" | "published",
  opts?: { force?: boolean },
): Promise<FloorPlanLayoutDTO | null> {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  const cacheKey = `${key}:${status}`;
  if (!opts?.force && layoutCache.has(cacheKey)) {
    return layoutCache.get(cacheKey) ?? null;
  }

  const res = await fetch(
    `/api/floor-plans/${encodeURIComponent(key)}/layout?status=${status}`,
    { credentials: "include" },
  );
  if (res.status === 404) {
    layoutCache.delete(cacheKey);
    return null;
  }
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  const layout = (await res.json()) as FloorPlanLayoutDTO;
  layoutCache.set(cacheKey, layout);
  return layout;
}

export async function fetchFloorPlanPublishedLayout(
  slug: string,
  opts?: { force?: boolean },
): Promise<FloorPlanLayoutDTO | null> {
  return fetchFloorPlanLayoutByStatus(slug, "published", opts);
}

/** Prefer published layout; fall back to draft for in-progress builder floors. */
export async function fetchFloorPlanViewLayout(
  slug: string,
  opts?: { force?: boolean },
): Promise<FloorPlanLayoutDTO | null> {
  const published = await fetchFloorPlanLayoutByStatus(slug, "published", opts);
  if (published) return published;
  return fetchFloorPlanLayoutByStatus(slug, "draft", opts);
}

export function invalidateFloorPlanLayoutCache(slug?: string) {
  if (!slug) {
    layoutCache.clear();
    return;
  }
  const key = slug.trim().toLowerCase();
  layoutCache.delete(`${key}:published`);
  layoutCache.delete(`${key}:draft`);
}
