import { ObjectId, type Db } from "mongodb";
import { allowInMemoryFallback } from "@/lib/data-backend";
import { swapCabinIdentitiesInLayout } from "@/lib/cabin-utils";
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

/** Keep side-cabin height rules (equalHeights / spans) in sync without wiping label/id swaps. */
function mergeCatalogSideCabinHeights(
  current: FloorPlanDTO["cabins"] | FloorPlanDocument["cabins"] | undefined,
  catalog: FloorPlanDTO["cabins"] | FloorPlanDocument["cabins"] | null | undefined,
): FloorPlanDTO["cabins"] | FloorPlanDocument["cabins"] | undefined {
  if (!current) return catalog ? structuredClone(catalog) : undefined;
  const catalogSide = catalog?.sideCabins;
  if (!catalogSide || !current.sideCabins) return current;
  return {
    ...current,
    sideCabins: {
      ...current.sideCabins,
      equalHeights: catalogSide.equalHeights,
      spans: catalogSide.spans
        ? { ...catalogSide.spans }
        : current.sideCabins.spans,
    },
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
    const preservedCabins = current.cabins ?? catalogCabins ?? seed.cabins;
    memoryFloorPlans[idx] = {
      ...current,
      name: seed.name,
      city: seed.city,
      building: seed.building,
      floors: seed.floors,
      sortOrder: seed.sortOrder,
      isActive: seed.isActive,
      // Preserve runtime cabin swaps; sync side height rules from catalog.
      cabins: mergeCatalogSideCabinHeights(preservedCabins, catalogCabins),
      rows: catalogRows ?? (current.rows?.length ? current.rows : seed.rows),
      seatIds: catalogRows
        ? seatIdsFromRows(catalogRows)
        : current.seatIds?.length
          ? current.seatIds
          : seed.seatIds,
    };
  }
}

export async function ensureFloorPlanSeeds(db: Db, companyId: string): Promise<void> {
  const col = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  const scope = companyScope<FloorPlanDocument>(companyId);
  for (const seed of buildFloorPlanSeeds()) {
    const existing = await col.findOne({ ...scope, slug: seed.slug });
    if (!existing) {
      await col.insertOne({
        _id: new ObjectId(),
        companyId: toCompanyObjectId(companyId),
        ...seed,
      });
      continue;
    }

    // Keep catalog labels in sync (Block A / Block B naming) for seeded offices.
    // Do not overwrite custom Excel/manual row geometry unless the doc has no rows
    // or this slug has a canonical catalog row layout (e.g. Bangalore entrance).
    // Do not overwrite cabins — admins may swap cabin places at runtime.
    const isCatalogSeed = !existing.source || existing.source === "seed";
    if (!isCatalogSeed) continue;

    const catalogRows = catalogRowsForSlug(seed.slug);
    const catalogCabins = catalogCabinsForSlug(seed.slug);
    const shouldSyncRows = Boolean(catalogRows) || !existing.rows?.length;
    const mergedCabins = mergeCatalogSideCabinHeights(
      existing.cabins,
      catalogCabins ?? seed.cabins,
    );

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
          updatedAt: new Date(),
          ...(mergedCabins ? { cabins: mergedCabins } : {}),
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

async function withDb(companyId: string): Promise<Db | null> {
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    return null;
  }
  await ensureFloorPlanSeeds(db, companyId);
  return db;
}

export async function listFloorPlans(
  companyId: string,
  opts?: {
  includeInactive?: boolean;
}): Promise<FloorPlanSummary[]> {
  const db = await withDb(companyId);
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

  const filter = opts?.includeInactive
    ? companyScope<FloorPlanDocument>(companyId)
    : { ...companyScope<FloorPlanDocument>(companyId), isActive: true };
  const rows = await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .find(filter)
    .sort({ sortOrder: 1, name: 1 })
    .toArray();
  return rows.map(floorPlanDocToSummary);
}

export async function getFloorPlanBySlug(
  companyId: string,
  slug: string,
): Promise<FloorPlanDTO | null> {
  const normalized = slug.trim().toLowerCase();
  const db = await withDb(companyId);
  const catalogRows = catalogRowsForSlug(normalized);
  const scope = companyScope<FloorPlanDocument>(companyId);

  if (!db) {
    ensureMemorySeeds();
    const row = memoryFloorPlans.find((p) => p.slug === normalized);
    if (!row) return null;
    const plan = clonePlan(row);
    if (catalogRows) {
      plan.rows = structuredClone(catalogRows);
      plan.seatIds = seatIdsFromRows(catalogRows);
    }
    return plan;
  }

  const doc = await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .findOne({ ...scope, slug: normalized });
  if (!doc) return null;
  const plan = floorPlanDocToDTO(doc);
  const patch: Partial<FloorPlanDocument> = { updatedAt: new Date() };
  // Preserve runtime cabin swaps — only sync canonical row geometry when needed.
  if (catalogRows) {
    plan.rows = structuredClone(catalogRows);
    plan.seatIds = seatIdsFromRows(catalogRows);
    patch.rows = catalogRows;
    patch.seatIds = plan.seatIds;
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

  const db = await withDb(companyId);
  if (!db) {
    ensureMemorySeeds();
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
  const db = await withDb(companyId);
  const scope = companyScope<FloorPlanDocument>(companyId);

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
  const existing = await col.findOne({ ...scope, slug: normalized });
  if (!existing) throw new Error("Floor plan not found");

  const next = applyPatch(floorPlanDocToDTO(existing));
  await col.updateOne(
    { ...scope, slug: normalized },
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

export async function deleteFloorPlan(companyId: string, slug: string): Promise<FloorPlanDTO> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) throw new Error("slug is required");

  const db = await withDb(companyId);
  const scope = companyScope<FloorPlanDocument>(companyId);
  if (!db) {
    ensureMemorySeeds();
    const idx = memoryFloorPlans.findIndex((p) => p.slug === normalized);
    if (idx < 0) throw new Error("Floor plan not found");
    const [removed] = memoryFloorPlans.splice(idx, 1);
    return clonePlan(removed);
  }

  const col = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  const existing = await col.findOne({ ...scope, slug: normalized });
  if (!existing) throw new Error("Floor plan not found");

  const dto = floorPlanDocToDTO(existing);
  const result = await col.deleteOne({ ...scope, slug: normalized });
  if (result.deletedCount < 1) {
    throw new Error("Floor plan not found");
  }
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

  for (const plan of plans) {
    const slug = plan.slug.trim().toLowerCase();
    const existing = await getFloorPlanBySlug(companyId, slug);
    if (!existing) {
      await createFloorPlan(companyId, plan);
      created.push(slug);
      continue;
    }
    await updateFloorPlan(companyId, slug, {
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

