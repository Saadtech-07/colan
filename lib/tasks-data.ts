import { ObjectId } from "mongodb";
import { resolveDefaultCompanyId } from "@/lib/companies";
import { getDb } from "@/lib/mongodb";
import { listEmployees, listProjects } from "@/lib/data-service";
import { syncProjectTaskStats } from "@/lib/project-stats";
import {
  COLLECTIONS,
  ensureColanModelIndexes,
  taskActivityDocToDTO,
  taskCommentDocToDTO,
  taskDocToDTO,
  toTaskDetail,
  type TaskActivityDocument,
  type TaskCommentDocument,
  type TaskDocument,
} from "@/models";
import type { Task, TaskDetail, TaskPriority, TaskStatus } from "@/types";

export type TaskListFilters = {
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
};

export type TaskCreateInput = {
  title: string;
  description?: string;
  projectId: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  createdById: string;
  createdByName?: string;
  comment?: string;
};

export type TaskUpdateInput = Partial<
  Pick<
    TaskCreateInput,
    | "title"
    | "description"
    | "projectId"
    | "assigneeId"
    | "status"
    | "priority"
    | "dueDate"
    | "comment"
  >
>;

export type TaskMutationActor = {
  id: string;
  name: string;
};

type MemoryTaskRow = TaskDocument & { id: string };

export const memoryTasks: MemoryTaskRow[] = [];
const memoryComments: TaskCommentDocument[] = [];
const memoryActivity: TaskActivityDocument[] = [];

function employeeNameMap(employees: Awaited<ReturnType<typeof listEmployees>>) {
  return new Map(employees.map((employee) => [employee.id, employee.name]));
}

function projectNameMap(projects: Awaited<ReturnType<typeof listProjects>>) {
  return new Map(projects.map((project) => [project.id, project.name]));
}

async function enrichTask(doc: TaskDocument): Promise<Task> {
  const companyId = await resolveDefaultCompanyId();
  const [employees, projects] = await Promise.all([
    listEmployees({ companyId }),
    listProjects(),
  ]);
  const employeeNames = employeeNameMap(employees);
  const projectNames = projectNameMap(projects);
  return taskDocToDTO(doc, {
    projectName: projectNames.get(doc.projectId),
    assigneeName: doc.assigneeId ? employeeNames.get(doc.assigneeId) : undefined,
    createdByName: employeeNames.get(doc.createdById),
  });
}

async function recordActivity(
  taskId: string,
  action: string,
  actor: TaskMutationActor,
  details?: string,
) {
  const db = await getDb();
  const entry: TaskActivityDocument = {
    _id: new ObjectId(),
    taskId,
    action,
    actorId: actor.id,
    actorName: actor.name,
    details,
    createdAt: new Date(),
  };

  if (!db) {
    memoryActivity.push(entry);
    return taskActivityDocToDTO(entry);
  }

  await ensureColanModelIndexes(db);
  await db.collection<TaskActivityDocument>(COLLECTIONS.taskActivity).insertOne(entry);
  return taskActivityDocToDTO(entry);
}

async function recordComment(
  taskId: string,
  author: TaskMutationActor,
  body: string,
) {
  const db = await getDb();
  const entry: TaskCommentDocument = {
    _id: new ObjectId(),
    taskId,
    authorId: author.id,
    authorName: author.name,
    body,
    createdAt: new Date(),
  };

  if (!db) {
    memoryComments.push(entry);
    return taskCommentDocToDTO(entry);
  }

  await ensureColanModelIndexes(db);
  await db.collection<TaskCommentDocument>(COLLECTIONS.taskComments).insertOne(entry);
  return taskCommentDocToDTO(entry);
}

function matchesFilters(task: TaskDocument, filters: TaskListFilters): boolean {
  if (filters.projectId && task.projectId !== filters.projectId) return false;
  if (filters.status && task.status !== filters.status) return false;
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false;
  return true;
}

export async function listTasks(filters: TaskListFilters = {}): Promise<Task[]> {
  const db = await getDb();
  if (!db) {
    const rows = memoryTasks
      .filter((task) => matchesFilters(task, filters))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return Promise.all(rows.map((row) => enrichTask(row)));
  }

  await ensureColanModelIndexes(db);
  const query: Record<string, unknown> = {};
  if (filters.projectId) query.projectId = filters.projectId;
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.assigneeId) query.assigneeId = filters.assigneeId;

  const docs = await db
    .collection<TaskDocument>(COLLECTIONS.tasks)
    .find(query)
    .sort({ updatedAt: -1 })
    .toArray();

  return Promise.all(docs.map((doc) => enrichTask(doc)));
}

export async function getTaskById(taskId: string): Promise<TaskDetail | null> {
  if (!ObjectId.isValid(taskId)) {
    const memoryRow = memoryTasks.find((row) => row._id.toHexString() === taskId);
    if (!memoryRow) return null;
    const task = await enrichTask(memoryRow);
    const comments = memoryComments
      .filter((row) => row.taskId === taskId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(taskCommentDocToDTO);
    const activity = memoryActivity
      .filter((row) => row.taskId === taskId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(taskActivityDocToDTO);
    return toTaskDetail(task, comments, activity);
  }

  const db = await getDb();
  if (!db) {
    const memoryRow = memoryTasks.find((row) => row._id.toHexString() === taskId);
    if (!memoryRow) return null;
    const task = await enrichTask(memoryRow);
    const comments = memoryComments
      .filter((row) => row.taskId === taskId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(taskCommentDocToDTO);
    const activity = memoryActivity
      .filter((row) => row.taskId === taskId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(taskActivityDocToDTO);
    return toTaskDetail(task, comments, activity);
  }

  await ensureColanModelIndexes(db);
  const doc = await db.collection<TaskDocument>(COLLECTIONS.tasks).findOne({
    _id: new ObjectId(taskId),
  });
  if (!doc) return null;

  const task = await enrichTask(doc);
  const [comments, activity] = await Promise.all([
    db
      .collection<TaskCommentDocument>(COLLECTIONS.taskComments)
      .find({ taskId })
      .sort({ createdAt: 1 })
      .toArray(),
    db
      .collection<TaskActivityDocument>(COLLECTIONS.taskActivity)
      .find({ taskId })
      .sort({ createdAt: -1 })
      .toArray(),
  ]);

  return toTaskDetail(
    task,
    comments.map(taskCommentDocToDTO),
    activity.map(taskActivityDocToDTO),
  );
}

export async function createTask(
  input: TaskCreateInput,
  actor: TaskMutationActor,
): Promise<TaskDetail> {
  const now = new Date();
  const db = await getDb();
  const doc: TaskDocument = {
    _id: new ObjectId(),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    projectId: input.projectId,
    assigneeId: input.assigneeId || undefined,
    status: input.status ?? "Todo",
    priority: input.priority ?? "Medium",
    dueDate: input.dueDate,
    createdById: input.createdById,
    createdAt: now,
    updatedAt: now,
  };

  if (!db) {
    memoryTasks.push({ ...doc, id: doc._id.toHexString() });
  } else {
    await ensureColanModelIndexes(db);
    await db.collection<TaskDocument>(COLLECTIONS.tasks).insertOne(doc);
  }

  const taskId = doc._id.toHexString();
  await recordActivity(taskId, "created", actor, `Created task "${doc.title}"`);
  if (input.comment?.trim()) {
    await recordComment(taskId, actor, input.comment.trim());
  }
  if (doc.assigneeId) {
    const { notifyTaskAssigned } = await import("@/lib/notifications-data");
    await notifyTaskAssigned({
      task: { id: taskId, title: doc.title, assigneeId: doc.assigneeId, projectId: doc.projectId },
      actor,
    });
  }

  await syncProjectTaskStats(doc.projectId);
  const detail = await getTaskById(taskId);
  if (!detail) throw new Error("Failed to load created task");
  return detail;
}

export async function updateTask(
  taskId: string,
  input: TaskUpdateInput,
  actor: TaskMutationActor,
): Promise<TaskDetail | null> {
  const existing = await getTaskById(taskId);
  if (!existing) return null;

  const db = await getDb();
  const now = new Date();
  const patch: Partial<TaskDocument> = { updatedAt: now };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.projectId !== undefined) patch.projectId = input.projectId;
  if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId || undefined;
  if (input.status !== undefined) patch.status = input.status;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate || undefined;

  if (!db) {
    const idx = memoryTasks.findIndex((row) => row._id.toHexString() === taskId);
    if (idx < 0) return null;
    memoryTasks[idx] = { ...memoryTasks[idx], ...patch };
  } else if (ObjectId.isValid(taskId)) {
    await ensureColanModelIndexes(db);
    await db.collection<TaskDocument>(COLLECTIONS.tasks).updateOne(
      { _id: new ObjectId(taskId) },
      { $set: patch },
    );
  }

  const changes: string[] = [];
  if (input.status && input.status !== existing.status) {
    changes.push(`Status: ${existing.status} → ${input.status}`);
    const { notifyTaskStatusChanged, notifyTaskCompleted } = await import(
      "@/lib/notifications-data"
    );
    await notifyTaskStatusChanged({
      task: {
        id: taskId,
        title: existing.title,
        assigneeId: input.assigneeId ?? existing.assigneeId,
        projectId: input.projectId ?? existing.projectId,
        status: input.status,
      },
      previousStatus: existing.status,
      actor,
    });
    if (input.status === "Done") {
      await notifyTaskCompleted({
        task: {
          id: taskId,
          title: existing.title,
          assigneeId: input.assigneeId ?? existing.assigneeId,
          projectId: input.projectId ?? existing.projectId,
        },
        actor,
      });
    }
  }
  if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
    changes.push("Assignee updated");
    if (input.assigneeId) {
      const { notifyTaskAssigned } = await import("@/lib/notifications-data");
      await notifyTaskAssigned({
        task: {
          id: taskId,
          title: existing.title,
          assigneeId: input.assigneeId,
          projectId: input.projectId ?? existing.projectId,
        },
        actor,
      });
    }
  }
  if (input.priority && input.priority !== existing.priority) {
    changes.push(`Priority: ${existing.priority} → ${input.priority}`);
  }

  await recordActivity(
    taskId,
    "updated",
    actor,
    changes.length > 0 ? changes.join("; ") : "Task details updated",
  );
  if (input.comment?.trim()) {
    await recordComment(taskId, actor, input.comment.trim());
  }

  const projectIds = new Set([existing.projectId]);
  if (input.projectId) projectIds.add(input.projectId);
  for (const projectId of projectIds) {
    await syncProjectTaskStats(projectId);
  }

  return getTaskById(taskId);
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  actor: TaskMutationActor,
  comment?: string,
): Promise<TaskDetail | null> {
  return updateTask(taskId, { status, comment }, actor);
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const existing = await getTaskById(taskId);
  if (!existing) return false;

  const db = await getDb();
  if (!db) {
    const idx = memoryTasks.findIndex((row) => row._id.toHexString() === taskId);
    if (idx < 0) return false;
    memoryTasks.splice(idx, 1);
    for (let i = memoryComments.length - 1; i >= 0; i -= 1) {
      if (memoryComments[i].taskId === taskId) memoryComments.splice(i, 1);
    }
    for (let i = memoryActivity.length - 1; i >= 0; i -= 1) {
      if (memoryActivity[i].taskId === taskId) memoryActivity.splice(i, 1);
    }
  } else if (ObjectId.isValid(taskId)) {
    await ensureColanModelIndexes(db);
    await db.collection<TaskDocument>(COLLECTIONS.tasks).deleteOne({
      _id: new ObjectId(taskId),
    });
    await db.collection<TaskCommentDocument>(COLLECTIONS.taskComments).deleteMany({ taskId });
    await db.collection<TaskActivityDocument>(COLLECTIONS.taskActivity).deleteMany({ taskId });
  }

  await syncProjectTaskStats(existing.projectId);
  return true;
}
