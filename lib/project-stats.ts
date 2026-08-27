import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { memoryStore } from "@/lib/memory-store";
import { COLLECTIONS, ensureColanModelIndexes, type ProjectDocument } from "@/models";

export async function syncProjectTaskStats(projectId: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    const { memoryTasks } = await import("@/lib/tasks-data");
    const tasks = memoryTasks.filter((task) => task.projectId === projectId);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.status === "Done").length;
    const progressPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const project = memoryStore.projects.find((row) => row.id === projectId);
    if (project) {
      project.totalTasks = totalTasks;
      project.completedTasks = completedTasks;
      project.progressPercentage = progressPercentage;
    }
    return;
  }

  await ensureColanModelIndexes(db);
  const taskCol = db.collection(COLLECTIONS.tasks);
  const [totalTasks, completedTasks] = await Promise.all([
    taskCol.countDocuments({ projectId }),
    taskCol.countDocuments({ projectId, status: "Done" }),
  ]);
  const progressPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const projectCol = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const filter = ObjectId.isValid(projectId)
    ? { _id: new ObjectId(projectId) }
    : { _id: { $exists: false } };

  await projectCol.updateOne(filter, {
    $set: {
      totalTasks,
      completedTasks,
      progressPercentage,
      updatedAt: new Date(),
    },
  });
}

export async function syncAllProjectTaskStats(): Promise<void> {
  const db = await getDb();
  if (!db) {
    const { memoryTasks } = await import("@/lib/tasks-data");
    const projectIds = [...new Set(memoryTasks.map((task) => task.projectId))];
    for (const projectId of projectIds) {
      await syncProjectTaskStats(projectId);
    }
    return;
  }

  await ensureColanModelIndexes(db);
  const projectCol = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const projects = await projectCol.find({}, { projection: { _id: 1 } }).toArray();
  for (const project of projects) {
    await syncProjectTaskStats(project._id.toHexString());
  }
}
