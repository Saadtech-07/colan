import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { listEmployees, listProjects } from "@/lib/data-service";
import { getDailyUpdateAttendance } from "@/lib/daily-updates-attendance";
import { canManageAnyTask, resolveTaskActor } from "@/lib/task-access";
import { filterEmployeesForUser, filterProjectsForUser, sessionAccessAsync } from "@/lib/session-access";

export async function GET(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const access = await sessionAccessAsync(ctx.session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await resolveTaskActor(access.email);
  if (!actor || !canManageAnyTask(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid date (YYYY-MM-DD) is required." }, { status: 400 });
  }

  const search = url.searchParams.get("search") ?? undefined;
  const employees = filterEmployeesForUser(
    await listEmployees({ companyId: ctx.companyId }),
    access.role,
    access.team,
  );
  const projects = filterProjectsForUser(
    await listProjects(),
    access.role,
    access.team,
  );

  const attendance = await getDailyUpdateAttendance({
    date,
    search,
    employees,
    projects,
  });

  return NextResponse.json(attendance, { headers: { "Cache-Control": "no-store" } });
}
