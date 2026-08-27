import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { filterProjectsForUser, sessionAccessAsync } from "@/lib/session-access";
import { listDailyUpdatesForProject } from "@/lib/daily-updates-data";
import { getProjectById } from "@/lib/data-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const visible = filterProjectsForUser([project], access.role, access.team);
  if (visible.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates = await listDailyUpdatesForProject(id);
  return NextResponse.json(updates, { headers: { "Cache-Control": "no-store" } });
}
