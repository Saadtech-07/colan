import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { listProjects } from "@/lib/data-service";
import {
  COLLECTIONS,
  dailyUpdateDocToDTO,
  ensureColanModelIndexes,
  type DailyUpdateDocument,
} from "@/models";
import type { DailyUpdate } from "@/types";

export type DailyUpdateCreateInput = {
  employeeId: string;
  employeeName: string;
  projectId: string;
  date: string;
  workDone: string;
  blockers: string;
  tomorrowPlan: string;
};

const memoryDailyUpdates: DailyUpdateDocument[] = [];

function projectNameMap(projects: Awaited<ReturnType<typeof listProjects>>) {
  return new Map(projects.map((project) => [project.id, project.name]));
}

async function enrichUpdate(doc: DailyUpdateDocument): Promise<DailyUpdate> {
  const projects = await listProjects();
  const names = projectNameMap(projects);
  return dailyUpdateDocToDTO(doc, { projectName: names.get(doc.projectId) });
}

export type DailyUpdateFilters = {
  projectId?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

function matchesDailyUpdateFilters(doc: DailyUpdateDocument, filters: DailyUpdateFilters): boolean {
  if (filters.projectId && doc.projectId !== filters.projectId) return false;
  if (filters.employeeId && doc.employeeId !== filters.employeeId) return false;
  if (filters.dateFrom && doc.date < filters.dateFrom) return false;
  if (filters.dateTo && doc.date > filters.dateTo) return false;
  if (filters.search?.trim()) {
    const needle = filters.search.trim().toLowerCase();
    const haystack = [
      doc.workDone,
      doc.blockers,
      doc.tomorrowPlan,
      doc.employeeName,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export async function listDailyUpdates(filters: DailyUpdateFilters = {}): Promise<DailyUpdate[]> {
  const db = await getDb();
  if (!db) {
    const rows = memoryDailyUpdates
      .filter((row) => matchesDailyUpdateFilters(row, filters))
      .sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    return Promise.all(rows.map((row) => enrichUpdate(row)));
  }

  await ensureColanModelIndexes(db);
  const query: Record<string, unknown> = {};
  if (filters.projectId) query.projectId = filters.projectId;
  if (filters.employeeId) query.employeeId = filters.employeeId;
  if (filters.dateFrom || filters.dateTo) {
    query.date = {};
    if (filters.dateFrom) (query.date as Record<string, string>).$gte = filters.dateFrom;
    if (filters.dateTo) (query.date as Record<string, string>).$lte = filters.dateTo;
  }

  let docs = await db
    .collection<DailyUpdateDocument>(COLLECTIONS.dailyUpdates)
    .find(query)
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  if (filters.search?.trim()) {
    docs = docs.filter((row) => matchesDailyUpdateFilters(row, filters));
  }

  return Promise.all(docs.map((row) => enrichUpdate(row)));
}

export async function listDailyUpdatesForProject(projectId: string): Promise<DailyUpdate[]> {
  return listDailyUpdates({ projectId });
}

export async function createDailyUpdate(
  input: DailyUpdateCreateInput,
  actor?: { id: string; name: string },
): Promise<DailyUpdate> {
  const db = await getDb();
  const doc: DailyUpdateDocument = {
    _id: new ObjectId(),
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    projectId: input.projectId,
    date: input.date,
    workDone: input.workDone.trim(),
    blockers: input.blockers.trim(),
    tomorrowPlan: input.tomorrowPlan.trim(),
    createdAt: new Date(),
  };

  if (!db) {
    memoryDailyUpdates.push(doc);
  } else {
    await ensureColanModelIndexes(db);
    await db.collection<DailyUpdateDocument>(COLLECTIONS.dailyUpdates).insertOne(doc);
  }

  const { notifyDailyUpdateSubmitted } = await import("@/lib/notifications-data");
  await notifyDailyUpdateSubmitted({
    update: {
      id: doc._id.toHexString(),
      employeeId: doc.employeeId,
      employeeName: doc.employeeName,
      projectId: doc.projectId,
      date: doc.date,
    },
    actor,
  });

  return enrichUpdate(doc);
}
