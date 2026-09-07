import { ObjectId, type Filter } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { resolveDefaultCompanyId } from "@/lib/companies";
import { COLLECTIONS, type AppUserDocument } from "@/models";
import type { Session } from "@/types/auth";

/** Fixed id for in-memory / demo mode when MongoDB is unavailable. */
export const DEMO_COMPANY_ID = "000000000000000000000001";

export function toCompanyObjectId(companyId: string): ObjectId {
  if (!ObjectId.isValid(companyId)) {
    throw new Error("Invalid company id.");
  }
  return new ObjectId(companyId);
}

/** Mongo filter fragment — always AND this into tenant-scoped queries. */
export function companyScope<T extends { companyId?: ObjectId }>(
  companyId: string,
): Filter<T> {
  return { companyId: toCompanyObjectId(companyId) } as Filter<T>;
}

/** Resolve tenant id from DB when legacy JWT cookies lack companyId. */
export async function resolveCompanyIdForEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return resolveDefaultCompanyId();

  const db = await getDb();
  if (!db) return DEMO_COMPANY_ID;

  const doc = await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .findOne({ email: normalized }, { projection: { companyId: 1 } });

  if (doc?.companyId) return doc.companyId.toHexString();
  return resolveDefaultCompanyId();
}

export async function hydrateSessionCompanyId(session: Session): Promise<Session> {
  if (session.user.companyId?.trim()) return session;
  const companyId = await resolveCompanyIdForEmail(session.user.email);
  return {
    ...session,
    user: { ...session.user, companyId },
  };
}

export function requireSessionCompanyId(session: Session | null): string {
  const companyId = session?.user?.companyId?.trim();
  if (!companyId) {
    throw new Error("No workspace assigned to this account.");
  }
  return companyId;
}

export async function requireSessionCompanyIdAsync(session: Session | null): Promise<string> {
  if (!session?.user) {
    throw new Error("No workspace assigned to this account.");
  }
  if (session.user.companyId?.trim()) return session.user.companyId.trim();
  return resolveCompanyIdForEmail(session.user.email);
}
