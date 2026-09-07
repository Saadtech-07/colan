import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { getProjectById, getProjectBySlug } from "@/lib/data-service";
import { filterProjectsForUser, sessionAccessAsync } from "@/lib/session-access";
import { addProjectMember, listProjectMembers } from "@/lib/people-data";
import { z } from "zod";

type Params = { params: Promise<{ slug: string }> };

async function resolveProject(idOrSlug: string) {
  if (ObjectId.isValid(idOrSlug)) {
    const byId = await getProjectById(idOrSlug);
    if (byId) return byId;
  }
  return getProjectBySlug(idOrSlug);
}

const memberCreateSchema = z.object({
  memberId: z.string().min(1),
});

export async function GET(_req: Request, { params }: Params) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const access = await sessionAccessAsync(ctx.session);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const project = await resolveProject(slug);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const visible = filterProjectsForUser([project], access.role, access.team);
  if (visible.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await listProjectMembers(ctx.companyId, project.id);
  return NextResponse.json(members ?? [], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: Params) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const access = await sessionAccessAsync(ctx.session);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const project = await resolveProject(slug);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const visible = filterProjectsForUser([project], access.role, access.team);
  if (visible.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = memberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await addProjectMember(project.id, parsed.data.memberId);
  if (!updated) return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  const members = await listProjectMembers(ctx.companyId, project.id);
  return NextResponse.json(members ?? [], { status: 201 });
}
