import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listEmployees, listProjects, setEmployeeProjects } from "@/lib/data-service";
import {
  assignableProjectsForEmployee,
  getProjectsForEmployee,
} from "@/lib/project-assignments";
import {
  canAssignEmployeeProjects,
  canManageProject,
} from "@/lib/permissions";
import { projectBelongsToTeam } from "@/lib/project-teams";
import { sessionAccessAsync } from "@/lib/session-access";
import { employeeProjectsUpdateSchema } from "@/lib/validations";
import { resolveAssignmentActorFromEmail } from "@/lib/notification-api";
import type { Project } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id: employeeId } = await params;
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAssignEmployeeProjects(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employees = await listEmployees();
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const projects = await listProjects();
  const canModify = (project: Project) =>
    canManageProject(access.role, project.teams, access.team);

  const assignable = assignableProjectsForEmployee(employee, projects, canModify);
  const assigned = getProjectsForEmployee(employeeId, projects).filter((p) =>
    projectBelongsToTeam(p, employee.team),
  );

  return NextResponse.json({ employee, assigned, assignable });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id: employeeId } = await params;
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAssignEmployeeProjects(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employees = await listEmployees();
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
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

  const canModify = (project: Project) =>
    canManageProject(access.role, project.teams, access.team);

  try {
    const actor = await resolveAssignmentActorFromEmail(session?.user?.email);
    const projects = await setEmployeeProjects(
      employeeId,
      parsed.data.projectIds,
      canModify,
      employee.team,
      { actor },
    );
    const assigned = getProjectsForEmployee(employeeId, projects).filter((p) =>
      projectBelongsToTeam(p, employee.team),
    );
    return NextResponse.json({
      projectIds: assigned.map((p) => p.id),
      projects: assigned,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to update projects" },
      { status: 400 },
    );
  }
}
