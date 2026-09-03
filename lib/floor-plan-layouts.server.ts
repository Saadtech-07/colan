import { ObjectId } from "mongodb";
import { extractSeatIds } from "@/lib/floor-plan-builder/layout-engine";
import type { FloorPlanLayoutState } from "@/lib/floor-plan-builder/types";
import { getDb } from "@/lib/mongodb";
import { toCompanyObjectId } from "@/lib/tenant-scope";
import { COLLECTIONS } from "@/models/collections";
import {
  floorPlanLayoutDocToDTO,
  type FloorPlanLayoutDocument,
  type FloorPlanLayoutDTO,
} from "@/models/floor-plan-layout.model";
import type { FloorPlanDocument } from "@/models/floor-plan.model";

function mergeGroupsFromLayout(layout: FloorPlanLayoutState) {
  const elements = layout.blocks?.length
    ? layout.blocks.flatMap((block) => block.elements)
    : layout.elements;
  const groups = new Map<string, string[]>();
  for (const el of elements) {
    if (el.type !== "seat" || !el.mergeGroupId || !el.seatId) continue;
    const list = groups.get(el.mergeGroupId) ?? [];
    list.push(el.seatId);
    groups.set(el.mergeGroupId, list);
  }
  return [...groups.entries()].map(([id, seatIds]) => ({ id, seatIds }));
}

export async function getFloorPlanLayout(
  companyId: string,
  slug: string,
  status: "draft" | "published" = "draft",
): Promise<FloorPlanLayoutDTO | null> {
  const db = await getDb();
  if (!db) return null;

  const doc = await db
    .collection<FloorPlanLayoutDocument>(COLLECTIONS.floorPlanLayouts)
    .findOne({
      companyId: toCompanyObjectId(companyId),
      floorPlanSlug: slug,
      status,
    });

  return doc ? floorPlanLayoutDocToDTO(doc) : null;
}

export async function saveFloorPlanLayoutDraft(
  companyId: string,
  slug: string,
  layout: FloorPlanLayoutState,
): Promise<FloorPlanLayoutDTO> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");

  const seatIds = extractSeatIds(layout);
  const mergeGroups = mergeGroupsFromLayout(layout);
  const now = new Date();

  const col = db.collection<FloorPlanLayoutDocument>(COLLECTIONS.floorPlanLayouts);
  const existing = await col.findOne({
    companyId: toCompanyObjectId(companyId),
    floorPlanSlug: slug,
    status: "draft",
  });

  const payload: Omit<FloorPlanLayoutDocument, "_id"> = {
    companyId: toCompanyObjectId(companyId),
    floorPlanSlug: slug,
    name: layout.name,
    status: "draft",
    version: existing?.version ?? 0,
    grid: layout.grid,
    elements: layout.elements,
    blocks: layout.blocks,
    seatIds,
    mergeGroups,
    updatedAt: now,
    createdAt: existing?.createdAt ?? now,
  };

  if (existing) {
    await col.updateOne({ _id: existing._id }, { $set: payload });
    const updated = await col.findOne({ _id: existing._id });
    if (!updated) throw new Error("Failed to save draft.");
    await syncFloorPlanDesignMetadata(companyId, slug, layout.name, seatIds, now);
    return floorPlanLayoutDocToDTO(updated);
  }

  const insertResult = await col.insertOne({
    _id: new ObjectId(),
    ...payload,
  });
  const created = await col.findOne({ _id: insertResult.insertedId });
  if (!created) throw new Error("Failed to save draft.");
  await syncFloorPlanDesignMetadata(companyId, slug, layout.name, seatIds, now);
  return floorPlanLayoutDocToDTO(created);
}

async function syncFloorPlanDesignMetadata(
  companyId: string,
  slug: string,
  name: string,
  seatIds: string[],
  updatedAt: Date,
) {
  const db = await getDb();
  if (!db) return;
  await db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans).updateOne(
    { companyId: toCompanyObjectId(companyId), slug },
    {
      $set: {
        name,
        seatIds,
        migrationStatus: "builder",
        updatedAt,
      },
    },
  );
}

export async function deleteFloorPlanDesigns(companyId: string, slug: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.collection<FloorPlanLayoutDocument>(COLLECTIONS.floorPlanDesigns).deleteMany({
    companyId: toCompanyObjectId(companyId),
    floorPlanSlug: slug,
  });
  return result.deletedCount ?? 0;
}

export async function publishFloorPlanLayout(
  companyId: string,
  slug: string,
  layout: FloorPlanLayoutState,
  publisher: { userId: string; name: string; email: string },
): Promise<FloorPlanLayoutDTO> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");

  const seatIds = extractSeatIds(layout);
  if (!seatIds.length) {
    throw new Error("Add at least one seat before publishing.");
  }

  const mergeGroups = mergeGroupsFromLayout(layout);
  const now = new Date();
  const col = db.collection<FloorPlanLayoutDocument>(COLLECTIONS.floorPlanLayouts);

  const latestPublished = await col.findOne(
    {
      companyId: toCompanyObjectId(companyId),
      floorPlanSlug: slug,
      status: "published",
    },
    { sort: { version: -1 } },
  );
  const nextVersion = (latestPublished?.version ?? 0) + 1;

  await col.deleteMany({
    companyId: toCompanyObjectId(companyId),
    floorPlanSlug: slug,
    status: "published",
  });

  const publishedDoc: FloorPlanLayoutDocument = {
    _id: new ObjectId(),
    companyId: toCompanyObjectId(companyId),
    floorPlanSlug: slug,
    name: layout.name,
    status: "published",
    version: nextVersion,
    grid: layout.grid,
    elements: layout.elements,
    blocks: layout.blocks,
    seatIds,
    mergeGroups,
    publishedAt: now,
    publishedBy: publisher,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(publishedDoc);

  await saveFloorPlanLayoutDraft(companyId, slug, { ...layout, status: "draft", version: nextVersion });

  await db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans).updateOne(
    { companyId: toCompanyObjectId(companyId), slug },
    {
      $set: {
        seatIds,
        migrationStatus: "builder",
        layoutVersion: nextVersion,
        updatedAt: now,
      },
    },
  );

  return floorPlanLayoutDocToDTO(publishedDoc);
}

export async function createFloorWithBuilderLayout(
  companyId: string,
  input: {
    name: string;
    city?: string;
    slug?: string;
    layout: FloorPlanLayoutState;
  },
): Promise<{ slug: string; layout: FloorPlanLayoutDTO }> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");

  const baseSlug =
    input.slug?.trim() ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);

  let slug = baseSlug || "floor";
  let suffix = 1;
  const planCol = db.collection<FloorPlanDocument>(COLLECTIONS.floorPlans);
  while (
    await planCol.findOne({
      companyId: toCompanyObjectId(companyId),
      slug,
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const seatIds = extractSeatIds(input.layout);
  const now = new Date();

  await planCol.insertOne({
    _id: new ObjectId(),
    companyId: toCompanyObjectId(companyId),
    slug,
    name: input.name,
    city: input.city,
    rows: [],
    seatIds,
    isActive: true,
    source: "manual",
    migrationStatus: "builder",
    layoutVersion: 0,
    createdAt: now,
    updatedAt: now,
  } as FloorPlanDocument & { migrationStatus?: string; layoutVersion?: number });

  const layout = await saveFloorPlanLayoutDraft(companyId, slug, {
    ...input.layout,
    name: input.name,
  });

  return { slug, layout };
}
