import { getDb, isMongoConfigured } from "@/lib/mongodb";

export class DataBackendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataBackendError";
  }
}

/** When true, empty MongoDB collections may be filled with demo rows from mock-data. */
export function isDemoSeedEnabled(): boolean {
  return process.env.ENABLE_DEMO_SEED?.trim().toLowerCase() === "true";
}

/** In-memory mock data is only used when Atlas is not configured at all. */
export function allowInMemoryFallback(): boolean {
  return !isMongoConfigured();
}

export async function requireDb(): Promise<NonNullable<Awaited<ReturnType<typeof getDb>>>> {
  if (!isMongoConfigured()) {
    throw new DataBackendError(
      "MONGODB_URI is not configured. Set it in .env.local and restart the dev server.",
    );
  }
  const db = await getDb();
  if (!db) {
    throw new DataBackendError(
      "MongoDB connection failed. Check MONGODB_URI and network access, then restart the server.",
    );
  }
  return db;
}
