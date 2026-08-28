import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { importFloorPlans } from "@/lib/floor-plans";
import {
  canAssignSeating,
  canManageModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { floorPlanImportSchema } from "@/lib/validations";

export async function POST(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (!canAssignSeating(roleKey) && !canManageModule(roleKey, "seating")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = floorPlanImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await importFloorPlans(ctx.companyId, parsed.data.plans);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
