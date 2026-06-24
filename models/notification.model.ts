import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const NOTIFICATION_COLLECTION = COLLECTIONS.notifications;

export type NotificationType = "project_assigned";

export type NotificationDocument = {
  _id: ObjectId;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: string;
  projectSlug?: string;
  projectName?: string;
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
  actorName?: string;
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
    actorName: doc.actorName,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}
