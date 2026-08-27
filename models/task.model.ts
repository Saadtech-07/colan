import type { ObjectId } from "mongodb";
import type { Task, TaskActivityEntry, TaskComment, TaskDetail, TaskPriority, TaskStatus } from "@/types";
import { COLLECTIONS } from "./collections";

export const TASK_COLLECTION = COLLECTIONS.tasks;
export const TASK_COMMENT_COLLECTION = COLLECTIONS.taskComments;
export const TASK_ACTIVITY_COLLECTION = COLLECTIONS.taskActivity;

export const TASK_STATUSES: TaskStatus[] = ["Todo", "In Progress", "Review", "Done"];
export const TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High", "Critical"];

export type TaskDocument = {
  _id: ObjectId;
  title: string;
  description?: string;
  projectId: string;
  assigneeId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskCommentDocument = {
  _id: ObjectId;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

export type TaskActivityDocument = {
  _id: ObjectId;
  taskId: string;
  action: string;
  actorId: string;
  actorName: string;
  details?: string;
  createdAt: Date;
};

export function taskDocToDTO(
  doc: TaskDocument,
  extras?: { projectName?: string; assigneeName?: string; createdByName?: string },
): Task {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    description: doc.description ?? "",
    projectId: doc.projectId,
    projectName: extras?.projectName,
    assigneeId: doc.assigneeId,
    assigneeName: extras?.assigneeName,
    status: doc.status,
    priority: doc.priority,
    dueDate: doc.dueDate,
    createdById: doc.createdById,
    createdByName: extras?.createdByName,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function taskCommentDocToDTO(doc: TaskCommentDocument): TaskComment {
  return {
    id: doc._id.toHexString(),
    taskId: doc.taskId,
    authorId: doc.authorId,
    authorName: doc.authorName,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function taskActivityDocToDTO(doc: TaskActivityDocument): TaskActivityEntry {
  return {
    id: doc._id.toHexString(),
    taskId: doc.taskId,
    action: doc.action,
    actorId: doc.actorId,
    actorName: doc.actorName,
    details: doc.details,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toTaskDetail(
  task: Task,
  comments: TaskComment[],
  activity: TaskActivityEntry[],
): TaskDetail {
  return { ...task, comments, activity };
}
