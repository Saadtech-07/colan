import { ObjectId } from "mongodb";
import { COLLECTIONS, type CompanyDocument } from "@/models";

/** Backfills tenant fields on legacy rows when the default workspace already exists. */
export async function ensureDefaultCompany(
  db: NonNullable<Awaited<ReturnType<typeof import("@/lib/mongodb").getDb>>>,
): Promise<ObjectId> {
  const col = db.collection<CompanyDocument>(COLLECTIONS.companies);
  let doc = await col.findOne({ slug: "colan" });
  if (!doc) {
    return new ObjectId("000000000000000000000001");
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
