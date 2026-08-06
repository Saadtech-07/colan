import { NextResponse } from "next/server";
import { auth } from "@/auth";
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const plans = await listFloorPlans();
    return NextResponse.json(plans);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list floor plans";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
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
    const created = await createFloorPlan(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
