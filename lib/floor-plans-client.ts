import { dedupeAsync } from "@/lib/dedupe-async";
import type { FloorPlanDTO, FloorPlanSummary } from "@/models/floor-plan.model";
import { parseApiError } from "@/providers/app-state";

export type CreateFloorPlanClientInput = {
  slug: string;
  name: string;
  city?: string;
  building?: string;
  floors?: Array<{ key: string; label: string }>;
  rows: FloorPlanDTO["rows"];
  cabins?: FloorPlanDTO["cabins"];
  isActive?: boolean;
  sortOrder?: number;
};

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

export async function createFloorPlanClient(
  input: CreateFloorPlanClientInput,
): Promise<FloorPlanDTO> {
  const res = await fetch("/api/floor-plans", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  const plan = (await res.json()) as FloorPlanDTO;
  invalidateFloorPlanClientCache();
  detailCache.set(plan.slug, plan);
  return plan;
}

export async function updateFloorPlanClient(
  slug: string,
  input: Omit<CreateFloorPlanClientInput, "slug">,
): Promise<FloorPlanDTO> {
  const key = slug.trim().toLowerCase();
  const res = await fetch(`/api/floor-plans/${encodeURIComponent(key)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  const plan = (await res.json()) as FloorPlanDTO;
  invalidateFloorPlanClientCache(key);
  detailCache.set(plan.slug, plan);
  return plan;
}

export async function deleteFloorPlanClient(slug: string): Promise<FloorPlanDTO> {
  const key = slug.trim().toLowerCase();
  const res = await fetch(`/api/floor-plans/${encodeURIComponent(key)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  const data = (await res.json()) as {
    plan?: FloorPlanDTO;
    slug?: string;
    name?: string;
  };
  const plan =
    data.plan ??
    ({
      slug: data.slug ?? key,
      name: data.name ?? key,
      rows: [],
      seatIds: [],
      isActive: false,
    } satisfies FloorPlanDTO);
  invalidateFloorPlanClientCache(key);
  return plan;
}

export async function swapFloorPlanCabinsClient(
  slug: string,
  cabinIdA: string,
  cabinIdB: string,
): Promise<FloorPlanDTO> {
  const key = slug.trim().toLowerCase();
  const res = await fetch(`/api/floor-plans/${encodeURIComponent(key)}/swap-cabins`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cabinIds: [cabinIdA, cabinIdB] }),
  });
  if (!res.ok) {
    let message = `Failed to swap cabins (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const plan = (await res.json()) as FloorPlanDTO;
  detailCache.set(key, plan);
  return plan;
}
