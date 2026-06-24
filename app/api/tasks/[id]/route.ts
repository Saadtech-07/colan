import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { filterProjectsForUser, sessionAccessAsync } from "@/lib/session-access";
import {
  canDeleteTask,
  canEditTask,
  resolveTaskActor,
} from "@/lib/task-access";
import { deleteTask, getTaskById, updateTask } from "@/lib/tasks-data";
import { taskUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

async function assertTaskVisible(taskId: string, access: Awaited<ReturnType<typeof sessionAccessAsync>>) {
  if (!access) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const task = await getTaskById(taskId);
  if (!task) return { error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };

  const visibleProjects = filterProjectsForUser(
    await (await import("@/lib/data-service")).listProjects(),
    access.role,
    access.team,
  );
  if (!visibleProjects.some((project) => project.id === task.projectId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const actor = await resolveTaskActor(access.email);
  return { task, actor };
}

export async function GET(_req: Request, { params }: Params) {
  const access = await sessionAccessAsync(await auth());
  const { id } = await params;
  const result = await assertTaskVisible(id, access);
  if ("error" in result && result.error) return result.error;

  const { task, actor } = result as Exclude<typeof result, { error: NextResponse }>;
  if (!canEditTask(actor!, task) && task.assigneeId !== actor?.employeeId) {
    const canManage = actor && (await import("@/lib/task-access")).canManageAnyTask(actor);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(task);
}

export async function PUT(req: Request, { params }: Params) {
  const access = await sessionAccessAsync(await auth());
  const { id } = await params;
  const result = await assertTaskVisible(id, access);
  if ("error" in result && result.error) return result.error;

  const { task, actor } = result as Exclude<typeof result, { error: NextResponse }>;
  if (!actor || !canEditTask(actor, task)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateTask(
    id,
    {
      ...parsed.data,
      assigneeId:
        parsed.data.assigneeId === null ? undefined : parsed.data.assigneeId,
      dueDate: parsed.data.dueDate === null ? undefined : parsed.data.dueDate,
    },
    {
      id: actor.employeeId ?? actor.appUserId,
      name: actor.name,
    },
  );
  if (!updated) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const access = await sessionAccessAsync(await auth());
  const { id } = await params;
  const result = await assertTaskVisible(id, access);
  if ("error" in result && result.error) return result.error;

  const { actor } = result as Exclude<typeof result, { error: NextResponse }>;
  if (!actor || !canDeleteTask(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = await deleteTask(id);
  if (!ok) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
