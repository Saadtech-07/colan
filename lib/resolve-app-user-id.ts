import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { ensureWorkspaceReady } from "@/lib/workspace-ready";
import { COLLECTIONS, type AppUserDocument } from "@/models";
import type { Session } from "@/types/auth";

declare global {
  // eslint-disable-next-line no-var
  var __colanAppUserIdByEmail: Map<string, string> | undefined;
}

function idCache(): Map<string, string> {
  if (!globalThis.__colanAppUserIdByEmail) {
    globalThis.__colanAppUserIdByEmail = new Map();
  }
  return globalThis.__colanAppUserIdByEmail;
}

/** Resolve MongoDB appUsers id from session JWT or a single cached lookup. */
export async function resolveAppUserId(session: Session): Promise<string | null> {
  const fromJwt = session.user.appUserId?.trim();
  if (fromJwt && ObjectId.isValid(fromJwt)) return fromJwt;

  const email = session.user.email.toLowerCase().trim();
  const cached = idCache().get(email);
  if (cached) return cached;

  const db = await getDb();
  if (!db) return null;

  await ensureWorkspaceReady(db);
  const doc = await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .findOne({ email }, { projection: { _id: 1 } });
  if (!doc) return null;

  const id = doc._id.toHexString();
  idCache().set(email, id);
  return id;
}

export function invalidateAppUserIdCache(email?: string): void {
  if (!email) {
    globalThis.__colanAppUserIdByEmail?.clear();
    return;
  }
  globalThis.__colanAppUserIdByEmail?.delete(email.toLowerCase().trim());
}
