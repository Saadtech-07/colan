import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { normalizeAppRole } from "@/lib/permissions";
import {
  COLLECTIONS,
  ensureColanModelIndexes,
  notificationDocToDTO,
  type AppUserDocument,
  type NotificationDocument,
  type NotificationDTO,
} from "@/models";

const memoryNotifications: NotificationDocument[] = [];

export type NotificationActor = {
  id: string;
  name: string;
};

async function listWorkflowNotificationRecipientUserIds(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  await ensureColanModelIndexes(db);
  const users = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).find({}).toArray();
  const recipientIds = new Set<string>();

  for (const user of users) {
    const role = normalizeAppRole(user.appRole);
    if (role === "admin" || role === "manager" || role === "lead") {
      recipientIds.add(user._id.toHexString());
    }
  }

  return [...recipientIds];
}

function sortNotifications(docs: NotificationDocument[]): NotificationDTO[] {
  return docs
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(notificationDocToDTO);
}

/** Hide outbound chat alerts — only show messages received from other people. */
export function filterNotificationsForViewer(
  notifications: NotificationDTO[],
  viewerUserId: string,
): NotificationDTO[] {
  const viewerId = viewerUserId.trim();
  if (!viewerId) return notifications;

  return notifications.filter((notification) => {
    if (notification.type !== "message_received") return true;
    if (!notification.actorUserId) return true;
    return notification.actorUserId !== viewerId;
  });
}

export async function listNotificationsForUser(
  recipientUserId: string,
  limit = 50,
  unreadOnly = false,
): Promise<NotificationDTO[]> {
  const db = await getDb();
  if (!db) {
    return sortNotifications(
      memoryNotifications.filter(
        (item) =>
          item.recipientUserId === recipientUserId && (!unreadOnly || !item.readAt),
      ),
    ).slice(0, limit);
  }

  await ensureColanModelIndexes(db);
  const docs = await db
    .collection<NotificationDocument>(COLLECTIONS.notifications)
    .find({
      recipientUserId,
      ...(unreadOnly
        ? { $or: [{ readAt: { $exists: false } }, { readAt: null }] }
        : {}),
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map((doc) => ({
    ...notificationDocToDTO(doc),
    recipientUserId: doc.recipientUserId,
  }));
}

export async function countNotificationsForUser(recipientUserId: string): Promise<number> {
  const db = await getDb();
  if (!db) {
    return memoryNotifications.filter((item) => item.recipientUserId === recipientUserId).length;
  }

  await ensureColanModelIndexes(db);
  return db.collection<NotificationDocument>(COLLECTIONS.notifications).countDocuments({
    recipientUserId,
  });
}

async function enrichNotificationsWithRecipients(
  docs: NotificationDocument[],
): Promise<NotificationDTO[]> {
  const db = await getDb();
  if (!db || docs.length === 0) {
    return docs.map((doc) => ({
      ...notificationDocToDTO(doc),
      recipientUserId: doc.recipientUserId,
    }));
  }

  const recipientIds = [...new Set(docs.map((doc) => doc.recipientUserId))].filter((id) =>
    ObjectId.isValid(id),
  );
  const users = await db
    .collection(COLLECTIONS.appUsers)
    .find({ _id: { $in: recipientIds.map((id) => new ObjectId(id)) } })
    .project({ name: 1 })
    .toArray();

  const nameById = new Map(users.map((user) => [user._id.toHexString(), user.name]));

  return docs.map((doc) => ({
    ...notificationDocToDTO(doc),
    recipientUserId: doc.recipientUserId,
    recipientName: nameById.get(doc.recipientUserId) ?? "Workspace user",
  }));
}

export async function listAllNotifications(
  limit = 100,
  unreadOnly = false,
): Promise<NotificationDTO[]> {
  const db = await getDb();
  if (!db) {
    const items = memoryNotifications
      .filter((item) => !unreadOnly || !item.readAt)
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return enrichNotificationsWithRecipients(items);
  }

  await ensureColanModelIndexes(db);
  const docs = await db
    .collection<NotificationDocument>(COLLECTIONS.notifications)
    .find(
      unreadOnly ? { $or: [{ readAt: { $exists: false } }, { readAt: null }] } : {},
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return enrichNotificationsWithRecipients(docs);
}

export async function countAllNotifications(): Promise<number> {
  const db = await getDb();
  if (!db) {
    return memoryNotifications.length;
  }

  await ensureColanModelIndexes(db);
  return db.collection<NotificationDocument>(COLLECTIONS.notifications).countDocuments({});
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

async function resolveProjectContext(projectId: string) {
  const { getProjectById } = await import("@/lib/data-service");
  return getProjectById(projectId);
}

export async function notifyTaskAssigned(input: {
  task: { id: string; title: string; assigneeId?: string; projectId: string };
  actor?: NotificationActor;
}): Promise<void> {
  if (!input.task.assigneeId) return;
  const recipientUserId = await findAppUserIdForEmployeeMongoId(input.task.assigneeId);
  if (!recipientUserId) return;
  if (input.actor?.id && recipientUserId === input.actor.id) return;

  const project = await resolveProjectContext(input.task.projectId);
  const actorName = input.actor?.name?.trim() || "A workspace manager";

  await createNotification({
    recipientUserId,
    type: "task_assigned",
    title: "Task assigned to you",
    message: `${actorName} assigned "${input.task.title}" to you.`,
    projectId: project?.id,
    projectSlug: project?.slug,
    projectName: project?.name,
    taskId: input.task.id,
    taskTitle: input.task.title,
    actorUserId: input.actor?.id,
    actorName,
  });
}

export async function notifyTaskStatusChanged(input: {
  task: {
    id: string;
    title: string;
    assigneeId?: string;
    projectId: string;
    status: string;
  };
  previousStatus: string;
  actor?: NotificationActor;
}): Promise<void> {
  if (!input.task.assigneeId) return;
  const recipientUserId = await findAppUserIdForEmployeeMongoId(input.task.assigneeId);
  if (!recipientUserId) return;

  const project = await resolveProjectContext(input.task.projectId);
  const actorName = input.actor?.name?.trim() || "A teammate";

  await createNotification({
    recipientUserId,
    type: "task_status_changed",
    title: "Task status updated",
    message: `${actorName} moved "${input.task.title}" from ${input.previousStatus} to ${input.task.status}.`,
    projectId: project?.id,
    projectSlug: project?.slug,
    projectName: project?.name,
    taskId: input.task.id,
    taskTitle: input.task.title,
    actorUserId: input.actor?.id,
    actorName,
  });
}

export async function notifyTaskCompleted(input: {
  task: { id: string; title: string; assigneeId?: string; projectId: string };
  actor?: NotificationActor;
}): Promise<void> {
  const project = await resolveProjectContext(input.task.projectId);
  const actorName = input.actor?.name?.trim() || "A teammate";

  const managerRecipients = new Set(await listWorkflowNotificationRecipientUserIds());

  if (project?.projectManagerId) {
    managerRecipients.add(project.projectManagerId);
  }

  for (const recipientUserId of managerRecipients) {
    if (input.actor?.id && recipientUserId === input.actor.id) continue;
    await createNotification({
      recipientUserId,
      type: "task_completed",
      title: "Task completed",
      message: `${actorName} completed "${input.task.title}".`,
      projectId: project?.id,
      projectSlug: project?.slug,
      projectName: project?.name,
      taskId: input.task.id,
      taskTitle: input.task.title,
      actorUserId: input.actor?.id,
      actorName,
    });
  }
}

export async function notifyDailyUpdateSubmitted(input: {
  update: {
    id: string;
    employeeId: string;
    employeeName: string;
    projectId: string;
    date: string;
  };
  actor?: NotificationActor;
}): Promise<void> {
  const project = await resolveProjectContext(input.update.projectId);
  const submitter = input.update.employeeName.trim() || "An employee";

  const managerRecipients = new Set(await listWorkflowNotificationRecipientUserIds());

  if (project?.projectManagerId) {
    managerRecipients.add(project.projectManagerId);
  }

  for (const recipientUserId of managerRecipients) {
    if (input.actor?.id && recipientUserId === input.actor.id) continue;
    await createNotification({
      recipientUserId,
      type: "daily_update_submitted",
      title: "Daily update submitted",
      message: `${submitter} submitted a daily update for ${project?.name ?? "a project"} on ${input.update.date}.`,
      projectId: project?.id,
      projectSlug: project?.slug,
      projectName: project?.name,
      actorUserId: input.actor?.id,
      actorName: submitter,
    });
  }
}

function previewMessageText(text: string, maxLength = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export async function notifyMessageReceived(input: {
  conversationId: string;
  senderUserId: string;
  senderName: string;
  recipientUserId: string;
  text: string;
}): Promise<void> {
  const recipientUserId = input.recipientUserId.trim();
  const senderUserId = input.senderUserId.trim();
  if (!recipientUserId || recipientUserId === senderUserId) return;

  const senderName = input.senderName.trim() || "Someone";
  const preview = previewMessageText(input.text);

  await createNotification({
    recipientUserId,
    type: "message_received",
    title: "New message",
    message: preview ? `${senderName}: ${preview}` : `${senderName} sent you a message.`,
    conversationId: input.conversationId,
    actorUserId: senderUserId,
    actorName: senderName,
  });
}
