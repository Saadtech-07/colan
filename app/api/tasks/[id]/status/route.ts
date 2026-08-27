import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { filterProjectsForUser, sessionAccessAsync } from "@/lib/session-access";
import { canEditTask, resolveTaskActor } from "@/lib/task-access";
import { getTaskById, updateTaskStatus } from "@/lib/tasks-data";
import { taskStatusPatchSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const task = await getTaskById(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const visibleProjects = filterProjectsForUser(
    await (await import("@/lib/data-service")).listProjects(),
    access.role,
    access.team,
  );
  if (!visibleProjects.some((project) => project.id === task.projectId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = await resolveTaskActor(access.email);
  if (!actor || !canEditTask(actor, task)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = taskStatusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateTaskStatus(
    id,
    parsed.data.status,
    { id: actor.employeeId ?? actor.appUserId, name: actor.name },
    parsed.data.comment,
  );
  if (!updated) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
