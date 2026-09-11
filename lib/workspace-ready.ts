import type { Db } from "mongodb";
import { ensureMongoReady } from "@/lib/data-service";
import { ensureColanModelIndexes } from "@/models";

declare global {
  // eslint-disable-next-line no-var
  var __colanWorkspaceReady: Map<string, Promise<void>> | undefined;
}

/** One-time indexes and legacy backfills per database per process. */
export async function ensureWorkspaceReady(db: Db): Promise<void> {
  const key = db.databaseName;
  if (!globalThis.__colanWorkspaceReady) {
    globalThis.__colanWorkspaceReady = new Map();
  }
  let pending = globalThis.__colanWorkspaceReady.get(key);
  if (!pending) {
    pending = (async () => {
      await ensureColanModelIndexes(db);
      await ensureMongoReady(db);
    })();
    globalThis.__colanWorkspaceReady.set(key, pending);
  }
  return pending;
}
