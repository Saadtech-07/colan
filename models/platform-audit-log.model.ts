import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const PLATFORM_AUDIT_LOG_COLLECTION = COLLECTIONS.platformAuditLogs;

export type PlatformAuditLogDocument = {
  _id: ObjectId;
  actorEmail: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  companyId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

export type PlatformAuditLogDTO = {
  id: string;
  actorEmail: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  companyId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export function platformAuditLogDocToDTO(doc: PlatformAuditLogDocument): PlatformAuditLogDTO {
  return {
    id: doc._id.toHexString(),
    actorEmail: doc.actorEmail,
    actorName: doc.actorName,
    action: doc.action,
    resourceType: doc.resourceType,
    resourceId: doc.resourceId,
    companyId: doc.companyId,
    metadata: doc.metadata,
    createdAt: doc.createdAt.toISOString(),
  };
}
