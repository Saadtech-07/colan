import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { swapFloorPlanCabins } from "@/lib/floor-plans";
import {
  canAssignSeating,
  canManageModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { floorPlanCabinSwapSchema } from "@/lib/validations";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Params) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (!canAssignSeating(roleKey) && !canManageModule(roleKey, "seating")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = floorPlanCabinSwapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const [cabinIdA, cabinIdB] = parsed.data.cabinIds;
    const updated = await swapFloorPlanCabins(ctx.companyId, slug, cabinIdA, cabinIdB);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cabin swap failed";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
