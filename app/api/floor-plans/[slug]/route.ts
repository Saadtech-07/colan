import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import {
  deleteFloorPlan,
  getFloorPlanBySlug,
  updateFloorPlan,
} from "@/lib/floor-plans";
import {
  canAssignSeating,
  canManageModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { floorPlanUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const { slug } = await params;
  try {
    const plan = await getFloorPlanBySlug(ctx.companyId, slug);
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Floor plan not found" }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load floor plan";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
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

  const parsed = floorPlanUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updated = await updateFloorPlan(ctx.companyId, slug, parsed.data);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (!canAssignSeating(roleKey) && !canManageModule(roleKey, "seating")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  try {
    const deleted = await deleteFloorPlan(ctx.companyId, slug);
    return NextResponse.json({
      ok: true,
      deleted: true,
      slug: deleted.slug,
      name: deleted.name,
      plan: deleted,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
