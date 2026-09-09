import { ObjectId } from "mongodb";
import { COLLECTIONS, type CompanyDocument } from "@/models";

/** Ensures the legacy default workspace exists and backfills tenant fields on old rows. */
export async function ensureDefaultCompany(
  db: NonNullable<Awaited<ReturnType<typeof import("@/lib/mongodb").getDb>>>,
): Promise<ObjectId> {
  const col = db.collection<CompanyDocument>(COLLECTIONS.companies);
  let doc = await col.findOne({ slug: "colan" });
  if (!doc) {
    const _id = new ObjectId();
    const now = new Date();
    doc = {
      _id,
      name: "Colan Infotech",
      slug: "colan",
      createdAt: now,
      updatedAt: now,
    };
    await col.insertOne(doc);
  }
  await backfillCompanyIds(db, doc._id);
  return doc._id;
}

async function backfillCompanyIds(
  db: NonNullable<Awaited<ReturnType<typeof import("@/lib/mongodb").getDb>>>,
  companyId: ObjectId,
): Promise<void> {
  const collections = [
    COLLECTIONS.appUsers,
    COLLECTIONS.employees,
    COLLECTIONS.companyRoles,
    COLLECTIONS.floorPlans,
    COLLECTIONS.seatingVersions,
    COLLECTIONS.seatingSeatHistory,
  ] as const;

  await Promise.all(
    collections.map((name) =>
      db.collection(name).updateMany({ companyId: { $exists: false } }, { $set: { companyId } }),
    ),
  );
}
