import { ObjectId, type Db } from "mongodb";
import { allowInMemoryFallback } from "@/lib/data-backend";
import {
  buildFloorPlanSeeds,
  catalogCabinsForSlug,
  catalogRowsForSlug,
  CHENNAI_BLOCK_A_SLUG,
  CHENNAI_BLOCK_B_SLUG,
  DEFAULT_OFFICE_SLUG,
  isChennaiOfficeSlug,
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
  const seeds = buildFloorPlanSeeds();
  for (const seed of seeds) {
    const idx = memoryFloorPlans.findIndex((p) => p.slug === seed.slug);
    const catalogCabins = catalogCabinsForSlug(seed.slug);
    const catalogRows = catalogRowsForSlug(seed.slug);
    const dto = {
      ...seedToDto(seed),
      createdAt: seed.createdAt,
      updatedAt: seed.updatedAt,
    };
    if (catalogCabins) dto.cabins = structuredClone(catalogCabins);
    if (catalogRows) {
      dto.rows = structuredClone(catalogRows);
      dto.seatIds = seatIdsFromRows(catalogRows);
    }
    if (idx === -1) {
      memoryFloorPlans.push(dto);
      continue;
    }
    // Align catalog labels/geometry for seeded offices.
    const current = memoryFloorPlans[idx];
    memoryFloorPlans[idx] = {
      ...current,
      name: seed.name,
      city: seed.city,
      building: seed.building,
      floors: seed.floors,
      sortOrder: seed.sortOrder,
      isActive: seed.isActive,
      cabins: catalogCabins ?? seed.cabins,
      rows: catalogRows ?? (current.rows?.length ? current.rows : seed.rows),
      seatIds: catalogRows
        ? seatIdsFromRows(catalogRows)
        : current.seatIds?.length
          ? current.seatIds
          : seed.seatIds,
    };
  }
}

async function ensureFloorPlanSeeds(db: Db): Promise<void> {
  const col = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  for (const seed of buildFloorPlanSeeds()) {
    const existing = await col.findOne({ slug: seed.slug });
    if (!existing) {
      await col.insertOne({
        _id: new ObjectId(),
        ...seed,
      });
      continue;
    }

    // Keep catalog labels in sync (Block A / Block B naming) for seeded offices.
    // Do not overwrite custom Excel/manual row geometry unless the doc has no rows
    // or this slug has a canonical catalog row layout (e.g. Bangalore entrance).
    const isCatalogSeed = !existing.source || existing.source === "seed";
    if (!isCatalogSeed) continue;

    const catalogRows = catalogRowsForSlug(seed.slug);
    const shouldSyncRows = Boolean(catalogRows) || !existing.rows?.length;

    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          name: seed.name,
          city: seed.city,
          building: seed.building,
          floors: seed.floors,
          sortOrder: seed.sortOrder,
          isActive: seed.isActive,
          cabins: seed.cabins,
          updatedAt: new Date(),
          ...(shouldSyncRows
            ? {
                rows: catalogRows ?? seed.rows,
                seatIds: catalogRows
                  ? seatIdsFromRows(catalogRows)
                  : seed.seatIds,
                source: seed.source,
              }
            : {}),
        },
      },
    );
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
  const catalogCabins = catalogCabinsForSlug(normalized);
  const catalogRows = catalogRowsForSlug(normalized);

  if (!db) {
    ensureMemorySeeds();
    const row = memoryFloorPlans.find((p) => p.slug === normalized);
    if (!row) return null;
    const plan = clonePlan(row);
    if (catalogCabins) plan.cabins = structuredClone(catalogCabins);
    if (catalogRows) {
      plan.rows = structuredClone(catalogRows);
      plan.seatIds = seatIdsFromRows(catalogRows);
    }
    return plan;
  }

  const doc = await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .findOne({ slug: normalized });
  if (!doc) return null;
  const plan = floorPlanDocToDTO(doc);
  const patch: Partial<FloorPlanDocument> = { updatedAt: new Date() };
  if (catalogCabins) {
    plan.cabins = structuredClone(catalogCabins);
    patch.cabins = catalogCabins;
  }
  if (catalogRows) {
    plan.rows = structuredClone(catalogRows);
    plan.seatIds = seatIdsFromRows(catalogRows);
    patch.rows = catalogRows;
    patch.seatIds = plan.seatIds;
  }
  if (catalogCabins || catalogRows) {
    await db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans).updateOne(
      { _id: doc._id },
      { $set: patch },
    );
  }
  return plan;
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

export {
  DEFAULT_OFFICE_SLUG,
  CHENNAI_BLOCK_A_SLUG,
  CHENNAI_BLOCK_B_SLUG,
  isChennaiOfficeSlug,
  normalizeOfficeSlug,
};

