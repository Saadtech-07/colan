import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import {
  createFloorPlan,
  listFloorPlans,
} from "@/lib/floor-plans";
import {
  canAssignSeating,
  canManageModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { floorPlanCreateSchema } from "@/lib/validations";

export async function GET() {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  try {
    const plans = await listFloorPlans(ctx.companyId);
    return NextResponse.json(plans);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list floor plans";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

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

  const parsed = floorPlanCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const created = await createFloorPlan(ctx.companyId, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
