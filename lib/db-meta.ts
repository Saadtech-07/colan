import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { ensureAppUsersSeed } from "@/lib/app-users";
import { COLLECTIONS, ensureColanModelIndexes, type CollectionName } from "@/models";
import type { DataLayerSummary } from "@/types/data-layer";

const COLLECTION_LABELS = {
  [COLLECTIONS.appUsers]: "App users (login)",
  [COLLECTIONS.appUserSeedSuppressions]: "App user seed suppressions",
  [COLLECTIONS.employees]: "Employees",
  [COLLECTIONS.employeeDetails]: "Employee details",
  [COLLECTIONS.teams]: "Teams",
  [COLLECTIONS.companyRoles]: "Company roles",
  [COLLECTIONS.seatingBays]: "Seating bays",
  [COLLECTIONS.seatingAssignments]: "Seating assignments",
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

/**
 * Lightweight read of where data lives and whether Atlas is reachable.
 * Ensures Colan indexes (and therefore empty collections) plus demo login
 * users exist; it does not insert directory / project / gallery demo rows
 * (those run from the data API layer on first use).
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
    await ensureColanModelIndexes(db);
    await ensureAppUsersSeed(db);
    const { ensureTeamsSeed } = await import("@/lib/teams-data");
    const { ensureRolesSeed } = await import("@/lib/roles-data");
    await ensureTeamsSeed(db);
    await ensureRolesSeed(db);
    const names = Object.values(COLLECTIONS) as CollectionName[];
    const allCollections = await Promise.all(
      names.map(async (name) => ({
        name,
        label: COLLECTION_LABELS[name],
        count: await db.collection(name).countDocuments(),
      })),
    );
    const countOf = (n: CollectionName) =>
      allCollections.find((c) => c.name === n)?.count ?? 0;
    return {
      backend: "mongodb",
      database: db.databaseName,
      counts: {
        employees: countOf(COLLECTIONS.employees),
        projects: countOf(COLLECTIONS.projects),
        gallery: countOf(COLLECTIONS.gallery),
        appUsers: countOf(COLLECTIONS.appUsers),
      },
      allCollections,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unknown error connecting to MongoDB.";
    return { backend: "error", message };
  }
}
