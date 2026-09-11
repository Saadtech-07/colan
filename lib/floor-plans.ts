import { ObjectId, type Db } from "mongodb";
import { allowInMemoryFallback } from "@/lib/data-backend";
import { swapCabinIdentitiesInLayout } from "@/lib/cabin-utils";
import {
  CHENNAI_BLOCK_A_SLUG,
  CHENNAI_BLOCK_B_SLUG,
  DEFAULT_OFFICE_SLUG,
  isChennaiOfficeSlug,
  normalizeOfficeSlug,
  seatIdsFromRows,
} from "@/lib/floor-plan-layouts";
import { getDb } from "@/lib/mongodb";
import { deleteFloorPlanDesigns } from "@/lib/floor-plan-layouts.server";
import { companyScope, toCompanyObjectId } from "@/lib/tenant-scope";
import { COLLECTIONS } from "@/models/collections";
import {
  floorPlanDocToDTO,
  floorPlanDocToSummary,
  type FloorPlanDocument,
  type FloorPlanDTO,
  type FloorPlanSummary,
} from "@/models/floor-plan.model";
import type { SeatingRowConfig } from "@/lib/seating-layout";

type MemoryFloorPlan = FloorPlanDTO & {
  createdAt?: Date;
  updatedAt?: Date;
};

const memoryFloorPlans: MemoryFloorPlan[] = [];

function clonePlan(plan: FloorPlanDTO): FloorPlanDTO {
  return structuredClone(plan);
}

async function withDb(): Promise<Db | null> {
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    return null;
  }
  return db;
}

export async function listFloorPlans(
  companyId: string,
  opts?: {
  includeInactive?: boolean;
}): Promise<FloorPlanSummary[]> {
  const db = await withDb();
  if (!db) {
    return memoryFloorPlans
      .filter((p) => opts?.includeInactive || p.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        city: p.city,
        building: p.building,
        isActive: p.isActive,
        sortOrder: p.sortOrder,
        seatCount: p.seatIds.length,
      }));
  }

  const filter = opts?.includeInactive
    ? companyScope<FloorPlanDocument>(companyId)
    : { ...companyScope<FloorPlanDocument>(companyId), isActive: true };
  const rows = await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .find(filter)
    .project<FloorPlanDocument>({
      slug: 1,
      name: 1,
      city: 1,
      building: 1,
      isActive: 1,
      sortOrder: 1,
      seatIds: 1,
      migrationStatus: 1,
      updatedAt: 1,
    })
    .sort({ sortOrder: 1, name: 1 })
    .toArray();
  return rows.map(floorPlanDocToSummary);
}

export async function getFloorPlanBySlug(
  companyId: string,
  slug: string,
): Promise<FloorPlanDTO | null> {
  const normalized = slug.trim().toLowerCase();
  const db = await withDb();
  const scope = companyScope<FloorPlanDocument>(companyId);

  if (!db) {
    const row = memoryFloorPlans.find((p) => p.slug === normalized);
    if (!row) return null;
    return clonePlan(row);
  }

  const doc = await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .findOne({ ...scope, slug: normalized });
  if (!doc) return null;
  return floorPlanDocToDTO(doc);
}

/** Batch-load floor plans by slug (single query). */
export async function getFloorPlansBySlugs(
  companyId: string,
  slugs: string[],
): Promise<Map<string, FloorPlanDTO>> {
  const normalized = [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))];
  const result = new Map<string, FloorPlanDTO>();
  if (normalized.length === 0) return result;

  const db = await withDb();
  if (!db) {
    for (const slug of normalized) {
      const row = memoryFloorPlans.find((p) => p.slug === slug);
      if (row) result.set(slug, clonePlan(row));
    }
    return result;
  }

  const docs = await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .find({ ...companyScope<FloorPlanDocument>(companyId), slug: { $in: normalized } })
    .toArray();

  for (const doc of docs) {
    result.set(doc.slug, floorPlanDocToDTO(doc));
  }
  return result;
}

export type CreateFloorPlanInput = {
  slug: string;
  name: string;
  city?: string;
  building?: string;
  floors?: Array<{ key: string; label: string }>;
  rows: SeatingRowConfig[];
  cabins?: FloorPlanDocument["cabins"];
  isActive?: boolean;
  sortOrder?: number;
};

export async function createFloorPlan(
  companyId: string,
  input: CreateFloorPlanInput,
): Promise<FloorPlanDTO> {
  const slug = input.slug.trim().toLowerCase();
  if (!slug) throw new Error("slug is required");
  if (!input.name.trim()) throw new Error("name is required");
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error("rows are required");
  }

  const seatIds = seatIdsFromRows(input.rows);
  const payload: FloorPlanDTO = {
    slug,
    name: input.name.trim(),
    city: input.city?.trim() || undefined,
    building: input.building?.trim() || undefined,
    floors: input.floors,
    rows: input.rows,
    seatIds,
    cabins: input.cabins,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 100,
    source: "manual",
  };

  const db = await withDb();
  if (!db) {
    if (memoryFloorPlans.some((p) => p.slug === slug)) {
      throw new Error(`Floor plan "${slug}" already exists`);
    }
    memoryFloorPlans.push({ ...payload, createdAt: new Date(), updatedAt: new Date() });
    return clonePlan(payload);
  }

  const col = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  const scope = companyScope<FloorPlanDocument>(companyId);
  const existing = await col.findOne({ ...scope, slug });
  if (existing) {
    // Soft-deleted leftovers block recreating the same slug — remove them first.
    if (existing.isActive === false) {
      await col.deleteOne({ _id: existing._id });
    } else {
      throw new Error(`Floor plan "${slug}" already exists`);
    }
  }

  const now = new Date();
  await col.insertOne({
    _id: new ObjectId(),
    companyId: toCompanyObjectId(companyId),
    ...payload,
    createdAt: now,
    updatedAt: now,
  });
  return payload;
}

export type UpdateFloorPlanInput = Partial<Omit<CreateFloorPlanInput, "slug">> & {
  isActive?: boolean;
};

export async function updateFloorPlan(
  companyId: string,
  slug: string,
  patch: UpdateFloorPlanInput,
): Promise<FloorPlanDTO> {
  const normalized = slug.trim().toLowerCase();
  const db = await withDb();
  const scope = companyScope<FloorPlanDocument>(companyId);

  if (!db) {
    const idx = memoryFloorPlans.findIndex((p) => p.slug === normalized);
    if (idx < 0) throw new Error("Floor plan not found");
    const current = memoryFloorPlans[idx];
    const rows = patch.rows ?? current.rows;
    const next: FloorPlanDTO = {
      ...current,
      name: patch.name?.trim() || current.name,
      city: patch.city !== undefined ? patch.city.trim() || undefined : current.city,
      building:
        patch.building !== undefined ? patch.building.trim() || undefined : current.building,
      floors: patch.floors ?? current.floors,
      rows,
      seatIds: patch.rows ? seatIdsFromRows(rows) : current.seatIds,
      cabins: patch.cabins ?? current.cabins,
      isActive: patch.isActive ?? current.isActive,
      sortOrder: patch.sortOrder ?? current.sortOrder,
    };
    memoryFloorPlans[idx] = { ...next, updatedAt: new Date() };
    return clonePlan(next);
  }

  const col = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  const updates: Partial<FloorPlanDocument> = { updatedAt: new Date() };
  if (patch.name?.trim()) updates.name = patch.name.trim();
  if (patch.city !== undefined) updates.city = patch.city.trim() || undefined;
  if (patch.building !== undefined) updates.building = patch.building.trim() || undefined;
  if (patch.floors !== undefined) updates.floors = patch.floors;
  if (patch.rows !== undefined) {
    updates.rows = patch.rows;
    updates.seatIds = seatIdsFromRows(patch.rows);
  }
  if (patch.cabins !== undefined) updates.cabins = patch.cabins;
  if (patch.isActive !== undefined) updates.isActive = patch.isActive;
  if (patch.sortOrder !== undefined) updates.sortOrder = patch.sortOrder;

  const updated = await col.findOneAndUpdate(
    { ...scope, slug: normalized },
    { $set: updates },
    { returnDocument: "after" },
  );
  if (!updated) throw new Error("Floor plan not found");
  return floorPlanDocToDTO(updated);
}

export async function deleteFloorPlan(companyId: string, slug: string): Promise<FloorPlanDTO> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) throw new Error("slug is required");

  const db = await withDb();
  const scope = companyScope<FloorPlanDocument>(companyId);
  if (!db) {
    const idx = memoryFloorPlans.findIndex((p) => p.slug === normalized);
    if (idx < 0) throw new Error("Floor plan not found");
    const [removed] = memoryFloorPlans.splice(idx, 1);
    return clonePlan(removed);
  }

  const col = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  const deleted = await col.findOneAndDelete({ ...scope, slug: normalized });
  if (!deleted) throw new Error("Floor plan not found");

  const dto = floorPlanDocToDTO(deleted);
  await deleteFloorPlanDesigns(companyId, normalized);
  return dto;
}

/** Swap two cabin places on a floor plan (labels + ids move; slot sizes stay). */
export async function swapFloorPlanCabins(
  companyId: string,
  slug: string,
  cabinIdA: string,
  cabinIdB: string,
): Promise<FloorPlanDTO> {
  const a = cabinIdA.trim();
  const b = cabinIdB.trim();
  if (!a || !b) throw new Error("Both cabin ids are required");
  if (a === b) throw new Error("Choose two different cabins to swap");

  const plan = await getFloorPlanBySlug(companyId, slug);
  if (!plan) throw new Error("Floor plan not found");
  if (!plan.cabins) throw new Error("This floor plan has no cabins");

  const nextCabins = swapCabinIdentitiesInLayout(plan.cabins, a, b);
  return updateFloorPlan(companyId, slug, { cabins: nextCabins });
}

export type ImportFloorPlanRow = CreateFloorPlanInput & {
  source?: FloorPlanDocument["source"];
};

/** Upsert plans from JSON import (Excel → JSON pipeline). */
export async function importFloorPlans(
  companyId: string,
  plans: ImportFloorPlanRow[],
): Promise<{ created: string[]; updated: string[] }> {
  const created: string[] = [];
  const updated: string[] = [];
  const normalized = plans.map((plan) => ({
    ...plan,
    slug: plan.slug.trim().toLowerCase(),
  }));

  const existingSlugs = new Set(
    [...(await getFloorPlansBySlugs(companyId, normalized.map((p) => p.slug))).keys()],
  );

  for (const plan of normalized) {
    if (!existingSlugs.has(plan.slug)) {
      await createFloorPlan(companyId, plan);
      created.push(plan.slug);
      continue;
    }
    await updateFloorPlan(companyId, plan.slug, {
      name: plan.name,
      city: plan.city,
      building: plan.building,
      floors: plan.floors,
      rows: plan.rows,
      cabins: plan.cabins,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    });
    updated.push(plan.slug);
  }

  return { created, updated };
}

export function isSeatOnPlan(bayId: string, plan: FloorPlanDTO): boolean {
  return plan.seatIds.includes(bayId);
}

export {
  DEFAULT_OFFICE_SLUG,
  CHENNAI_BLOCK_A_SLUG,
  CHENNAI_BLOCK_B_SLUG,
  isChennaiOfficeSlug,
  normalizeOfficeSlug,
};

