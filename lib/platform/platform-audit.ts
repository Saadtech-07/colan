import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  COLLECTIONS,
  platformAuditLogDocToDTO,
  type PlatformAuditLogDocument,
  type PlatformAuditLogDTO,
} from "@/models";

export type PlatformAuditInput = {
  actorEmail: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  companyId?: string;
  metadata?: Record<string, unknown>;
};

export async function writePlatformAuditLog(input: PlatformAuditInput): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const col = db.collection<PlatformAuditLogDocument>(COLLECTIONS.platformAuditLogs);
  await col.createIndex({ createdAt: -1 });
  await col.insertOne({
    _id: new ObjectId(),
    actorEmail: input.actorEmail,
    actorName: input.actorName,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    companyId: input.companyId,
    metadata: input.metadata,
    createdAt: new Date(),
  });
}

export async function listPlatformAuditLogs(opts?: {
  limit?: number;
}): Promise<PlatformAuditLogDTO[]> {
  const db = await getDb();
  if (!db) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const rows = await db
    .collection<PlatformAuditLogDocument>(COLLECTIONS.platformAuditLogs)
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return rows.map(platformAuditLogDocToDTO);
}
