import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { COLLECTIONS } from "@/models";
import type { DataLayerSummary } from "@/types/data-layer";

<<<<<<< HEAD
const COLLECTION_LABELS = {
  [COLLECTIONS.appUsers]: "App users (login)",
  [COLLECTIONS.appUserSeedSuppressions]: "App user seed suppressions",
  [COLLECTIONS.employees]: "Employees",
  [COLLECTIONS.employeeDetails]: "Employee details",
  [COLLECTIONS.teams]: "Teams",
  [COLLECTIONS.companyRoles]: "Company roles",
  [COLLECTIONS.seatingBays]: "Seating bays",
  [COLLECTIONS.seatingAssignments]: "Seating assignments",
  [COLLECTIONS.seatingVersions]: "Seating versions",
  [COLLECTIONS.seatingSeatHistory]: "Seating seat history",
  [COLLECTIONS.floorPlans]: "Floor plans",
  [COLLECTIONS.teamMembers]: "Team members",
  [COLLECTIONS.projects]: "Projects",
  [COLLECTIONS.gallery]: "Gallery",
  [COLLECTIONS.passwordResetTokens]: "Password reset tokens",
  [COLLECTIONS.conversations]: "Chat conversations",
  [COLLECTIONS.messages]: "Chat messages",
  [COLLECTIONS.notifications]: "Notifications",
  [COLLECTIONS.tasks]: "Tasks",
  [COLLECTIONS.taskComments]: "Task comments",
  [COLLECTIONS.taskActivity]: "Task activity",
  [COLLECTIONS.dailyUpdates]: "Daily updates",
} satisfies Record<CollectionName, string>;

=======
>>>>>>> origin/dev-2
/**
 * Fast connectivity + document counts for the dashboard.
 * Does not run index setup, seeding, or full collection scans.
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
      db.collection(COLLECTIONS.employees).estimatedDocumentCount(),
      db.collection(COLLECTIONS.projects).estimatedDocumentCount(),
      db.collection(COLLECTIONS.gallery).estimatedDocumentCount(),
      db.collection(COLLECTIONS.appUsers).estimatedDocumentCount(),
    ]);

    return {
      backend: "mongodb",
      database: db.databaseName,
      counts: { employees, projects, gallery, appUsers },
      allCollections: [],
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unknown error connecting to MongoDB.";
    return { backend: "error", message };
  }
}
