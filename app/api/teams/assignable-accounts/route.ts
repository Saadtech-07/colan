import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { listTeamAssignableAccounts } from "@/lib/app-users";
import { ensureRoleRegistry } from "@/lib/role-registry.server";

export async function GET() {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  if (ctx.session.user.appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureRoleRegistry(ctx.companyId);
  const accounts = await listTeamAssignableAccounts(ctx.companyId);
  return NextResponse.json(accounts);
}
