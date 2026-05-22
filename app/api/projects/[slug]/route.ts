import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getProjectDetailBySlug,
  updateProjectBySlug,
} from "@/lib/data-service";
import { assertTeamsExist } from "@/lib/teams-data";
import {
  assertCanCreateProject,
  filterProjectsForUser,
  sessionAccessAsync,
} from "@/lib/session-access";
import { projectUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const detail = await getProjectDetailBySlug(slug);
  if (!detail) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const visible = filterProjectsForUser([detail], access.role, access.team);
  if (visible.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const existing = await getProjectDetailBySlug(slug);
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const denied = assertCanCreateProject(access, existing.teams);
  if (denied) {
    return NextResponse.json({ error: denied }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const nextTeams = parsed.data.teams ?? existing.teams;
  const teamDenied = assertCanCreateProject(access, nextTeams);
  if (teamDenied) {
    return NextResponse.json({ error: teamDenied }, { status: 403 });
  }
  const teamsMissing = await assertTeamsExist(nextTeams);
  if (teamsMissing) {
    return NextResponse.json({ error: teamsMissing }, { status: 400 });
  }

  const updated = await updateProjectBySlug(slug, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const detail = await getProjectDetailBySlug(updated.slug);
  return NextResponse.json(detail);
}
