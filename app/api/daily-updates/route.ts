import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { filterProjectsForUser, sessionAccessAsync } from "@/lib/session-access";
import { canManageAnyTask, resolveTaskActor } from "@/lib/task-access";
import { createDailyUpdate, listDailyUpdates } from "@/lib/daily-updates-data";
import { dailyUpdateCreateSchema } from "@/lib/validations";

export async function GET(req: Request) {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const visibleProjects = filterProjectsForUser(
    await (await import("@/lib/data-service")).listProjects(),
    access.role,
    access.team,
  );
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));

  let updates = await listDailyUpdates({ projectId, employeeId, dateFrom, dateTo, search });
  updates = updates.filter((update) => visibleProjectIds.has(update.projectId));

  const actor = await resolveTaskActor(access.email);
  if (!canManageAnyTask(actor ?? { appUserId: "", name: "", email: access.email, appRole: access.role })) {
    if (!actor?.employeeId) {
      updates = [];
    } else {
      updates = updates.filter((update) => update.employeeId === actor.employeeId);
    }
  }

  return NextResponse.json(updates, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await resolveTaskActor(access.email);
  if (!actor?.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = dailyUpdateCreateSchema.safeParse(body);
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

  const created = await createDailyUpdate(
    {
      ...parsed.data,
      employeeId: actor.employeeId,
      employeeName: actor.name,
      blockers: parsed.data.blockers ?? "",
    },
    { id: actor.appUserId, name: actor.name },
  );

  return NextResponse.json(created, { status: 201 });
}
