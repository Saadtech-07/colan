import { ObjectId, type Db } from "mongodb";
import { allowInMemoryFallback } from "@/lib/data-backend";
import {
  buildFloorPlanSeeds,
  DEFAULT_OFFICE_SLUG,
  normalizeOfficeSlug,
  seatIdsFromRows,
} from "@/lib/floor-plan-layouts";
import { getDb } from "@/lib/mongodb";
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

function seedToDto(seed: ReturnType<typeof buildFloorPlanSeeds>[number]): FloorPlanDTO {
  return {
    slug: seed.slug,
    name: seed.name,
    city: seed.city,
    building: seed.building,
    floors: seed.floors,
    rows: seed.rows,
    seatIds: seed.seatIds,
    cabins: seed.cabins,
    isActive: seed.isActive,
    sortOrder: seed.sortOrder,
    source: seed.source,
  };
}

function ensureMemorySeeds() {
  if (memoryFloorPlans.length > 0) return;
  for (const seed of buildFloorPlanSeeds()) {
    memoryFloorPlans.push({
      ...seedToDto(seed),
      createdAt: seed.createdAt,
      updatedAt: seed.updatedAt,
    });
  }
}

async function ensureFloorPlanSeeds(db: Db): Promise<void> {
  const col = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  for (const seed of buildFloorPlanSeeds()) {
    const existing = await col.findOne({ slug: seed.slug });
    if (existing) continue;
    await col.insertOne({
      _id: new ObjectId(),
      ...seed,
    });
  }
}

async function withDb(): Promise<Db | null> {
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    return null;
  }
  await ensureFloorPlanSeeds(db);
  return db;
}

export async function listFloorPlans(opts?: {
  includeInactive?: boolean;
}): Promise<FloorPlanSummary[]> {
  const db = await withDb();
  if (!db) {
    ensureMemorySeeds();
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

  const filter = opts?.includeInactive ? {} : { isActive: true };
  const rows = await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .find(filter)
    .sort({ sortOrder: 1, name: 1 })
    .toArray();
  return rows.map(floorPlanDocToSummary);
}

export async function getFloorPlanBySlug(slug: string): Promise<FloorPlanDTO | null> {
  const normalized = slug.trim().toLowerCase();
  const db = await withDb();
  if (!db) {
    ensureMemorySeeds();
    const row = memoryFloorPlans.find((p) => p.slug === normalized);
    return row ? clonePlan(row) : null;
  }

  const doc = await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .findOne({ slug: normalized });
  return doc ? floorPlanDocToDTO(doc) : null;
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

export async function createFloorPlan(input: CreateFloorPlanInput): Promise<FloorPlanDTO> {
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
    ensureMemorySeeds();
    if (memoryFloorPlans.some((p) => p.slug === slug)) {
      throw new Error(`Floor plan "${slug}" already exists`);
    }
    memoryFloorPlans.push({ ...payload, createdAt: new Date(), updatedAt: new Date() });
    return clonePlan(payload);
  }

  const col = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  const existing = await col.findOne({ slug });
  if (existing) throw new Error(`Floor plan "${slug}" already exists`);

  const now = new Date();
  await col.insertOne({
    _id: new ObjectId(),
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
  slug: string,
  patch: UpdateFloorPlanInput,
): Promise<FloorPlanDTO> {
  const normalized = slug.trim().toLowerCase();
  const db = await withDb();

  const applyPatch = (current: FloorPlanDTO): FloorPlanDTO => {
    const rows = patch.rows ?? current.rows;
    return {
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
  };

  if (!db) {
    ensureMemorySeeds();
    const idx = memoryFloorPlans.findIndex((p) => p.slug === normalized);
    if (idx < 0) throw new Error("Floor plan not found");
    const next = applyPatch(memoryFloorPlans[idx]);
    memoryFloorPlans[idx] = { ...next, updatedAt: new Date() };
    return clonePlan(next);
  }

  const col = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  const existing = await col.findOne({ slug: normalized });
  if (!existing) throw new Error("Floor plan not found");

  const next = applyPatch(floorPlanDocToDTO(existing));
  await col.updateOne(
    { slug: normalized },
    {
      $set: {
        name: next.name,
        city: next.city,
        building: next.building,
        floors: next.floors,
        rows: next.rows,
        seatIds: next.seatIds,
        cabins: next.cabins,
        isActive: next.isActive,
        sortOrder: next.sortOrder,
        updatedAt: new Date(),
      },
    },
  );
  return next;
}

export async function deleteFloorPlan(slug: string): Promise<FloorPlanDTO> {
  return updateFloorPlan(slug, { isActive: false });
}

export type ImportFloorPlanRow = CreateFloorPlanInput & {
  source?: FloorPlanDocument["source"];
};

/** Upsert plans from JSON import (Excel → JSON pipeline). */
export async function importFloorPlans(
  plans: ImportFloorPlanRow[],
): Promise<{ created: string[]; updated: string[] }> {
  const created: string[] = [];
  const updated: string[] = [];

  for (const plan of plans) {
    const slug = plan.slug.trim().toLowerCase();
    const existing = await getFloorPlanBySlug(slug);
    if (!existing) {
      await createFloorPlan(plan);
      created.push(slug);
      continue;
    }
    await updateFloorPlan(slug, {
      name: plan.name,
      city: plan.city,
      building: plan.building,
      floors: plan.floors,
      rows: plan.rows,
      cabins: plan.cabins,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    });
    updated.push(slug);
  }

  return { created, updated };
}

export function isSeatOnPlan(bayId: string, plan: FloorPlanDTO): boolean {
  return plan.seatIds.includes(bayId);
}

export { DEFAULT_OFFICE_SLUG, normalizeOfficeSlug };

