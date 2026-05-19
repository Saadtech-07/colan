import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setEmployeeProjects } from "@/lib/data-service";
import { canManageProjectForTeam, canManageProjects } from "@/lib/permissions";
import { sessionAccess } from "@/lib/session-access";
import { employeeProjectsUpdateSchema } from "@/lib/validations";
import type { TeamName } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id: employeeId } = await params;
  const session = await auth();
  const access = sessionAccess(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageProjects(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = employeeProjectsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const canModify = (project: { team: TeamName }) =>
    canManageProjectForTeam(access.role, project.team, access.team);

  try {
    const projects = await setEmployeeProjects(
      employeeId,
      parsed.data.projectIds,
      canModify,
    );
    const assigned = projects.filter((p) => p.memberIds.includes(employeeId));
    return NextResponse.json({ projectIds: assigned.map((p) => p.id), projects: assigned });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to update projects" },
      { status: 400 },
    );
  }
}
