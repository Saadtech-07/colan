import type { Db } from "mongodb";
import { ensureMongoSeed } from "@/lib/data-service";
import { ensureColanModelIndexes } from "@/models";

declare global {
  // eslint-disable-next-line no-var
  var __colanWorkspaceReady: Map<string, Promise<void>> | undefined;
}

/** One-time indexes + demo seed per database per process. Safe on every read path. */
export async function ensureWorkspaceReady(db: Db): Promise<void> {
  const key = db.databaseName;
  if (!globalThis.__colanWorkspaceReady) {
    globalThis.__colanWorkspaceReady = new Map();
  }
  let pending = globalThis.__colanWorkspaceReady.get(key);
  if (!pending) {
    pending = (async () => {
      await ensureColanModelIndexes(db);
      await ensureMongoSeed(db);
    })();
    globalThis.__colanWorkspaceReady.set(key, pending);
  }
  return pending;
}
