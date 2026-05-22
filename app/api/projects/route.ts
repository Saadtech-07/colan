import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createProject, listProjects } from "@/lib/data-service";
import { assertTeamsExist } from "@/lib/teams-data";
import {
  assertCanCreateProject,
  filterProjectsForUser,
  sessionAccessAsync,
} from "@/lib/session-access";
import { projectCreateSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projects = await listProjects();
  return NextResponse.json(
    filterProjectsForUser(projects, access.role, access.team),
  );
}

export async function POST(req: Request) {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const denied = assertCanCreateProject(access, parsed.data.teams);
  if (denied) {
    return NextResponse.json({ error: denied }, { status: 403 });
  }
  const teamsMissing = await assertTeamsExist(parsed.data.teams);
  if (teamsMissing) {
    return NextResponse.json({ error: teamsMissing }, { status: 400 });
  }
  try {
    const created = await createProject({
      ...parsed.data,
      memberIds: parsed.data.memberIds ?? [],
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create project";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
