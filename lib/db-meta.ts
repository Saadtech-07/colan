import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { COLLECTIONS } from "@/models";
import type { DataLayerSummary } from "@/types/data-layer";

/**
 * Lightweight read of where data lives and whether Atlas is reachable.
 * Does not run seeding (counts reflect what is already in the database).
 */
export async function getDataLayerSummary(): Promise<DataLayerSummary> {
  if (!isMongoConfigured()) {
    return {
      backend: "memory",
      reason:
        "MONGODB_URI is missing or empty — set it in .env and restart the dev server.",
    };
  }

  try {
    const db = await getDb();
    if (!db) {
      return {
        backend: "memory",
        reason: "Database handle unavailable after connect.",
      };
    }
    await db.command({ ping: 1 });
    const [employees, projects, gallery, appUsers] = await Promise.all([
      db.collection(COLLECTIONS.employees).countDocuments(),
      db.collection(COLLECTIONS.projects).countDocuments(),
      db.collection(COLLECTIONS.gallery).countDocuments(),
      db.collection(COLLECTIONS.appUsers).countDocuments(),
    ]);
    return {
      backend: "mongodb",
      database: db.databaseName,
      counts: { employees, projects, gallery, appUsers },
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unknown error connecting to MongoDB.";
    return { backend: "error", message };
  }
}
