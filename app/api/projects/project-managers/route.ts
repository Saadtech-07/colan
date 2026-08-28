import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { listProjectManagerAccounts } from "@/lib/app-users";
import { canManageProjects, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { sessionAccessAsync } from "@/lib/session-access";

export async function GET() {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const access = await sessionAccessAsync(ctx.session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(access.role);
  if (!canManageProjects(roleKey)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const managers = await listProjectManagerAccounts(ctx.companyId);
  return NextResponse.json(managers);
}
