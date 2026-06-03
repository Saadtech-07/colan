import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listProjectManagerAccounts } from "@/lib/app-users";
import { canManageProjects, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { sessionAccessAsync } from "@/lib/session-access";

export async function GET() {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(access.role);
  if (!canManageProjects(roleKey)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const managers = await listProjectManagerAccounts();
  return NextResponse.json(managers);
}
