import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { filterProjectsForUser, sessionAccessAsync } from "@/lib/session-access";
import {
  canCreateTasks,
  filterTasksForAccess,
  resolveTaskActor,
} from "@/lib/task-access";
import { createTask, listTasks, type TaskListFilters } from "@/lib/tasks-data";
import { taskCreateSchema } from "@/lib/validations";
import type { TaskPriority, TaskStatus } from "@/types";

export async function GET(req: Request) {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const filters: TaskListFilters = {};
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status") as TaskStatus | null;
  const priority = url.searchParams.get("priority") as TaskPriority | null;
  const assigneeId = url.searchParams.get("assigneeId");
  if (projectId) filters.projectId = projectId;
  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (assigneeId) filters.assigneeId = assigneeId;

  const actor = await resolveTaskActor(access.email);
  const visibleProjects = filterProjectsForUser(
    await (await import("@/lib/data-service")).listProjects(),
    access.role,
    access.team,
  );
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
  const tasks = filterTasksForAccess(
    await listTasks(filters),
    access,
    actor,
    visibleProjectIds,
  );

  return NextResponse.json(tasks, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await resolveTaskActor(access.email);
  if (!actor || !canCreateTasks(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!actor.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const visibleProjects = filterProjectsForUser(
    await (await import("@/lib/data-service")).listProjects(),
    access.role,
    access.team,
  );
  if (!visibleProjects.some((project) => project.id === parsed.data.projectId)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const created = await createTask(
      {
        ...parsed.data,
        createdById: actor.employeeId,
        createdByName: actor.name,
      },
      { id: actor.employeeId, name: actor.name },
    );
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create task";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
