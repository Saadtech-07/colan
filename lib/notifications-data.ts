import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  COLLECTIONS,
  ensureColanModelIndexes,
  notificationDocToDTO,
  type NotificationDocument,
  type NotificationDTO,
} from "@/models";

const memoryNotifications: NotificationDocument[] = [];

export type NotificationActor = {
  id: string;
  name: string;
};

function sortNotifications(docs: NotificationDocument[]): NotificationDTO[] {
  return docs
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(notificationDocToDTO);
}

export async function listNotificationsForUser(
  recipientUserId: string,
  limit = 50,
): Promise<NotificationDTO[]> {
  const db = await getDb();
  if (!db) {
    return sortNotifications(
      memoryNotifications.filter((item) => item.recipientUserId === recipientUserId),
    ).slice(0, limit);
  }

  await ensureColanModelIndexes(db);
  const docs = await db
    .collection<NotificationDocument>(COLLECTIONS.notifications)
    .find({ recipientUserId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map(notificationDocToDTO);
}

export async function getUnreadNotificationCount(recipientUserId: string): Promise<number> {
  const db = await getDb();
  if (!db) {
    return memoryNotifications.filter(
      (item) => item.recipientUserId === recipientUserId && !item.readAt,
    ).length;
  }

  await ensureColanModelIndexes(db);
  return db.collection<NotificationDocument>(COLLECTIONS.notifications).countDocuments({
    recipientUserId,
    $or: [{ readAt: { $exists: false } }, { readAt: null }],
  });
}

export async function markNotificationRead(
  notificationId: string,
  recipientUserId: string,
): Promise<NotificationDTO | null> {
  if (!ObjectId.isValid(notificationId)) return null;

  const db = await getDb();
  const readAt = new Date();

  if (!db) {
    const item = memoryNotifications.find(
      (entry) =>
        entry._id.toHexString() === notificationId &&
        entry.recipientUserId === recipientUserId,
    );
    if (!item) return null;
    item.readAt = readAt;
    return notificationDocToDTO(item);
  }

  await ensureColanModelIndexes(db);
  const result = await db
    .collection<NotificationDocument>(COLLECTIONS.notifications)
    .findOneAndUpdate(
      { _id: new ObjectId(notificationId), recipientUserId },
      { $set: { readAt } },
      { returnDocument: "after" },
    );

  return result ? notificationDocToDTO(result) : null;
}

export async function markAllNotificationsRead(recipientUserId: string): Promise<number> {
  const db = await getDb();
  const readAt = new Date();

  if (!db) {
    let count = 0;
    for (const item of memoryNotifications) {
      if (item.recipientUserId === recipientUserId && !item.readAt) {
        item.readAt = readAt;
        count += 1;
      }
    }
    return count;
  }

  await ensureColanModelIndexes(db);
  const result = await db
    .collection<NotificationDocument>(COLLECTIONS.notifications)
    .updateMany(
      {
        recipientUserId,
        $or: [{ readAt: { $exists: false } }, { readAt: null }],
      },
      { $set: { readAt } },
    );

  return result.modifiedCount;
}

export async function createNotification(
  input: Omit<NotificationDocument, "_id" | "createdAt" | "readAt">,
): Promise<NotificationDTO> {
  const db = await getDb();
  const doc: NotificationDocument = {
    _id: new ObjectId(),
    ...input,
    readAt: null,
    createdAt: new Date(),
  };

  if (!db) {
    memoryNotifications.push(doc);
    return notificationDocToDTO(doc);
  }

  await ensureColanModelIndexes(db);
  await db.collection<NotificationDocument>(COLLECTIONS.notifications).insertOne(doc);
  return notificationDocToDTO(doc);
}

export async function findAppUserIdForEmployeeMongoId(
  employeeMongoId: string,
): Promise<string | null> {
  if (!ObjectId.isValid(employeeMongoId)) return null;

  const db = await getDb();
  if (!db) return null;

  await ensureColanModelIndexes(db);
  const employeeCol = db.collection(COLLECTIONS.employees);
  const employee = await employeeCol.findOne({ _id: new ObjectId(employeeMongoId) });
  if (!employee) return null;

  const appUserCol = db.collection(COLLECTIONS.appUsers);
  const employeeCode = String(employee.employeeId ?? "").trim();
  if (employeeCode) {
    const byCode = await appUserCol.findOne({
      employeeId: {
        $regex: new RegExp(
          `^${employeeCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i",
        ),
      },
    });
    if (byCode) return byCode._id.toHexString();
  }

  const emailCandidates = [
    typeof employee.email === "string" ? employee.email.trim().toLowerCase() : "",
    typeof employee.directory?.workEmail === "string"
      ? employee.directory.workEmail.trim().toLowerCase()
      : "",
  ].filter(Boolean);

  for (const email of emailCandidates) {
    const byEmail = await appUserCol.findOne({ email });
    if (byEmail) return byEmail._id.toHexString();
  }

  return null;
}

export async function notifyNewProjectMembers(input: {
  project: { id: string; slug: string; name: string };
  previousMemberIds: string[];
  nextMemberIds: string[];
  actor?: NotificationActor;
}): Promise<void> {
  const previous = new Set(input.previousMemberIds);
  const added = input.nextMemberIds.filter((memberId) => !previous.has(memberId));
  if (added.length === 0) return;

  const actorName = input.actor?.name?.trim() || "A workspace manager";
  const actorUserId = input.actor?.id;

  for (const employeeMongoId of added) {
    const recipientUserId = await findAppUserIdForEmployeeMongoId(employeeMongoId);
    if (!recipientUserId) continue;
    if (actorUserId && recipientUserId === actorUserId) continue;

    await createNotification({
      recipientUserId,
      type: "project_assigned",
      title: "Added to a project",
      message: `${actorName} added you to "${input.project.name}".`,
      projectId: input.project.id,
      projectSlug: input.project.slug,
      projectName: input.project.name,
      actorUserId,
      actorName,
    });
  }
}
