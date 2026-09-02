import { ObjectId, type Db } from "mongodb";
import { COLLECTIONS } from "./collections";
import type { AppUserDocument } from "./app-user.model";
import type { EmployeeDocument } from "./employee.model";
import type { EmployeeDetailsDocument } from "./employee-details.model";
import type { TeamDocument } from "./team.model";
import type { CompanyRoleDocument } from "./company-role.model";
import type { SeatingVersionDocument } from "./seating-version.model";
import type { SeatHistoryDocument } from "./seating-seat-history.model";
import type { FloorPlanDocument } from "./floor-plan.model";
import type { FloorPlanLayoutDocument } from "./floor-plan-layout.model";
import type { TeamMemberDocument } from "./team-member.model";
import type { ProjectDocument } from "./project.model";
import type { GalleryImageDocument } from "./gallery-image.model";
import type { CompanyDocument } from "./company.model";
import { ensureChatConversationIndexes } from "@/lib/chat-indexes";
import type { MessageDocument } from "./message.model";
import type { NotificationDocument } from "./notification.model";
import type { TaskActivityDocument, TaskCommentDocument, TaskDocument } from "./task.model";
import type { DailyUpdateDocument } from "./daily-update.model";
import { ensureDefaultCompany } from "@/lib/tenant-migration";

async function removeDuplicateEmployeeIds(db: Db, companyId: ObjectId): Promise<void> {
  const collection = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const duplicates = await collection
    .aggregate<{ _id: string; ids: ObjectId[] }>([
      { $match: { companyId, employeeId: { $type: "string" } } },
      {
        $group: {
          _id: "$employeeId",
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  for (const dup of duplicates) {
    const sortedIds = dup.ids.slice().sort((a, b) =>
      a.toHexString().localeCompare(b.toHexString()),
    );
    const [, ...remove] = sortedIds;
    if (remove.length === 0) continue;
    await collection.deleteMany({ _id: { $in: remove } });
  }
}

async function removeInvalidCompanyRoleKeys(db: Db, companyId: ObjectId): Promise<void> {
  const collection = db.collection<CompanyRoleDocument>(COLLECTIONS.companyRoles);

  await collection.deleteMany({
    companyId,
    $or: [
      { key: { $exists: false } },
      { key: { $type: 10 } },
    ],
  });

  const duplicates = await collection
    .aggregate<{ _id: string; ids: ObjectId[] }>([
      { $match: { companyId, key: { $type: "string" } } },
      {
        $group: {
          _id: "$key",
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  for (const dup of duplicates) {
    const sortedIds = dup.ids.slice().sort((a, b) =>
      a.toHexString().localeCompare(b.toHexString()),
    );
    const [, ...remove] = sortedIds;
    if (remove.length === 0) continue;
    await collection.deleteMany({ _id: { $in: remove } });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __colanIndexesPromise: Map<string, Promise<void>> | undefined;
}

const INDEX_SETUP_VERSION = 8;

function indexesCacheKey(db: Db): string {
  return `${db.databaseName}:v${INDEX_SETUP_VERSION}`;
}

/**
 * Idempotent index setup for Colan collections. Runs once per database per process.
 */
export async function ensureColanModelIndexes(db: Db): Promise<void> {
  const key = indexesCacheKey(db);
  if (!globalThis.__colanIndexesPromise) {
    globalThis.__colanIndexesPromise = new Map();
  }
  let pending = globalThis.__colanIndexesPromise.get(key);
  if (!pending) {
    pending = ensureColanModelIndexesWork(db);
    globalThis.__colanIndexesPromise.set(key, pending);
  }
  return pending;
}

async function ensureColanModelIndexesWork(db: Db): Promise<void> {
  const defaultCompanyId = await ensureDefaultCompany(db);

  await db.collection<CompanyDocument>(COLLECTIONS.companies).createIndex({ slug: 1 }, { unique: true });

  await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .createIndex({ email: 1 }, { unique: true });
  await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .createIndex({ companyId: 1, email: 1 });

  await removeDuplicateEmployeeIds(db, defaultCompanyId);
  await db
    .collection<EmployeeDocument>(COLLECTIONS.employees)
    .createIndex({ companyId: 1, employeeId: 1 }, { unique: true });
  await db.collection<EmployeeDocument>(COLLECTIONS.employees).createIndex({ companyId: 1, bayNumber: 1 });
  await db.collection<EmployeeDocument>(COLLECTIONS.employees).createIndex({ companyId: 1, team: 1, name: 1 });

  await db
    .collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails)
    .createIndex({ employeeRef: 1 }, { unique: true });

  await db
    .collection<TeamDocument>(COLLECTIONS.teams)
    .createIndex({ name: 1 }, { unique: true });
  await db.collection<TeamDocument>(COLLECTIONS.teams).createIndex({ slug: 1 }, { unique: true });
  await db
    .collection<TeamDocument>(COLLECTIONS.teams)
    .createIndex({ code: 1 }, { unique: true, sparse: true });

  await removeInvalidCompanyRoleKeys(db, defaultCompanyId);
  await db
    .collection<CompanyRoleDocument>(COLLECTIONS.companyRoles)
    .createIndex({ companyId: 1, key: 1 }, { unique: true });

  await db
    .collection<SeatingVersionDocument>(COLLECTIONS.seatingVersions)
    .createIndex({ companyId: 1, officeSlug: 1, version: -1 }, { unique: true });
  await db
    .collection<SeatingVersionDocument>(COLLECTIONS.seatingVersions)
    .createIndex({ companyId: 1, officeSlug: 1, createdAt: -1 });

  await db
    .collection<SeatHistoryDocument>(COLLECTIONS.seatingSeatHistory)
    .createIndex({ companyId: 1, officeSlug: 1, seatId: 1, createdAt: -1 });

  await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .createIndex({ companyId: 1, slug: 1 }, { unique: true });
  await db
    .collection<FloorPlanDocument>(COLLECTIONS.floorPlans)
    .createIndex({ companyId: 1, isActive: 1, sortOrder: 1 });

  await db
    .collection<FloorPlanLayoutDocument>(COLLECTIONS.floorPlanLayouts)
    .createIndex({ companyId: 1, floorPlanSlug: 1, status: 1 });
  await db
    .collection<FloorPlanLayoutDocument>(COLLECTIONS.floorPlanLayouts)
    .createIndex({ companyId: 1, floorPlanSlug: 1, version: -1 });

  await db.collection<EmployeeDocument>(COLLECTIONS.employees).createIndex({
    companyId: 1,
    officeSlug: 1,
    bayNumber: 1,
  });

  await db
    .collection<TeamMemberDocument>(COLLECTIONS.teamMembers)
    .createIndex({ appUserEmail: 1 }, { unique: true });
  await db.collection<TeamMemberDocument>(COLLECTIONS.teamMembers).createIndex({ employeeRef: 1 });

  await db
    .collection<ProjectDocument>(COLLECTIONS.projects)
    .createIndex({ slug: 1 }, { unique: true });
  await db.collection<ProjectDocument>(COLLECTIONS.projects).createIndex({
    teams: 1,
    assignedDate: -1,
  });

  await db.collection<GalleryImageDocument>(COLLECTIONS.gallery).createIndex({ uploadedAt: -1 });

  await db
    .collection(COLLECTIONS.passwordResetTokens)
    .createIndex({ tokenHash: 1 }, { unique: true });
  await db
    .collection(COLLECTIONS.passwordResetTokens)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection(COLLECTIONS.passwordResetTokens).createIndex({ email: 1 });

  await ensureChatConversationIndexes(db);

  await db
    .collection<MessageDocument>(COLLECTIONS.messages)
    .createIndex({ conversationId: 1, createdAt: 1 });
  await db.collection<MessageDocument>(COLLECTIONS.messages).createIndex({ receiverId: 1, isRead: 1 });

  await db
    .collection<NotificationDocument>(COLLECTIONS.notifications)
    .createIndex({ recipientUserId: 1, createdAt: -1 });
  await db
    .collection<NotificationDocument>(COLLECTIONS.notifications)
    .createIndex({ recipientUserId: 1, readAt: 1 });

  await db.collection<TaskDocument>(COLLECTIONS.tasks).createIndex({ projectId: 1, status: 1 });
  await db.collection<TaskDocument>(COLLECTIONS.tasks).createIndex({ assigneeId: 1, status: 1 });
  await db.collection<TaskDocument>(COLLECTIONS.tasks).createIndex({ createdAt: -1 });

  await db
    .collection<TaskCommentDocument>(COLLECTIONS.taskComments)
    .createIndex({ taskId: 1, createdAt: 1 });

  await db
    .collection<TaskActivityDocument>(COLLECTIONS.taskActivity)
    .createIndex({ taskId: 1, createdAt: -1 });

  await db
    .collection<DailyUpdateDocument>(COLLECTIONS.dailyUpdates)
    .createIndex({ date: -1, projectId: 1 });
  await db
    .collection<DailyUpdateDocument>(COLLECTIONS.dailyUpdates)
    .createIndex({ employeeId: 1, date: -1 });
}
