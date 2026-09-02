import type { FloorPlanLayoutDTO } from "@/models/floor-plan-layout.model";
import { parseApiError } from "@/providers/app-state";

const layoutCache = new Map<string, FloorPlanLayoutDTO>();

export async function fetchFloorPlanPublishedLayout(
  slug: string,
  opts?: { force?: boolean },
): Promise<FloorPlanLayoutDTO | null> {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  if (!opts?.force && layoutCache.has(key)) {
    return layoutCache.get(key) ?? null;
  }

  const res = await fetch(
    `/api/floor-plans/${encodeURIComponent(key)}/layout?status=published`,
    { credentials: "include" },
  );
  if (res.status === 404) {
    layoutCache.delete(key);
    return null;
  }
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  const layout = (await res.json()) as FloorPlanLayoutDTO;
  layoutCache.set(key, layout);
  return layout;
}

export function invalidateFloorPlanLayoutCache(slug?: string) {
  if (!slug) {
    layoutCache.clear();
    return;
  }
  layoutCache.delete(slug.trim().toLowerCase());
}
