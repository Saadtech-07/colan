import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const NOTIFICATION_COLLECTION = COLLECTIONS.notifications;

export type NotificationType =
  | "project_assigned"
  | "task_assigned"
  | "task_status_changed"
  | "task_completed"
  | "daily_update_submitted";

export type NotificationDocument = {
  _id: ObjectId;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: string;
  projectSlug?: string;
  projectName?: string;
  taskId?: string;
  taskTitle?: string;
  actorUserId?: string;
  actorName?: string;
  readAt?: Date | null;
  createdAt: Date;
};

export type NotificationDTO = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: string;
  projectSlug?: string;
  projectName?: string;
  taskId?: string;
  taskTitle?: string;
  actorName?: string;
  recipientUserId?: string;
  recipientName?: string;
  readAt: string | null;
  createdAt: string;
};

export function notificationDocToDTO(doc: NotificationDocument): NotificationDTO {
  return {
    id: doc._id.toHexString(),
    type: doc.type,
    title: doc.title,
    message: doc.message,
    projectId: doc.projectId,
    projectSlug: doc.projectSlug,
    projectName: doc.projectName,
    taskId: doc.taskId,
    taskTitle: doc.taskTitle,
    actorName: doc.actorName,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}
