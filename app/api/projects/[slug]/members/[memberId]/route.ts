import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProjectById, getProjectBySlug } from "@/lib/data-service";
import { filterProjectsForUser, sessionAccessAsync } from "@/lib/session-access";
import { listProjectMembers, removeProjectMember } from "@/lib/people-data";

type Params = { params: Promise<{ slug: string; memberId: string }> };

async function resolveProject(idOrSlug: string) {
  if (ObjectId.isValid(idOrSlug)) {
    const byId = await getProjectById(idOrSlug);
    if (byId) return byId;
  }
  return getProjectBySlug(idOrSlug);
}

export async function DELETE(_req: Request, { params }: Params) {
  const access = await sessionAccessAsync(await auth());
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, memberId } = await params;
  const project = await resolveProject(slug);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const visible = filterProjectsForUser([project], access.role, access.team);
  if (visible.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await removeProjectMember(project.id, memberId);
  if (!updated) return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });

  const members = await listProjectMembers(project.id);
  return NextResponse.json(members ?? []);
}
