import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAppUser, listAppUsers } from "@/lib/app-users";
import { canManageModule, canViewModule, normalizeAppRole, roleNeedsTeam } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { appUserCreateSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (!canViewModule(roleKey, "appUsers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await listAppUsers();
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (!canManageModule(roleKey, "appUsers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = appUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  if (roleNeedsTeam(payload.appRole) && !payload.team) {
    return NextResponse.json(
      { error: "Team is required for lead and employee roles." },
      { status: 400 },
    );
  }

  try {
    const created = await createAppUser(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create account" },
      { status: 400 },
    );
  }
}
