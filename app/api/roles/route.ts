import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  canAccessModuleAction,
  canManageModule,
  canViewModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { hydrateRoleRegistry } from "@/lib/role-registry";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { createWorkspaceRole, listWorkspaceRoles } from "@/lib/roles-data";
import {
  parseRolePermissionsInput,
  workspaceRoleCreateSchema,
} from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (!canViewModule(roleKey, "roles")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roles = await listWorkspaceRoles();
  hydrateRoleRegistry(roles);

  const sorted = [...roles].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
  return NextResponse.json(sorted, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (
    !canManageModule(roleKey, "roles") &&
    !canAccessModuleAction(roleKey, "roles", "createRoles")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = workspaceRoleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const created = await createWorkspaceRole({
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      color: parsed.data.color,
      permissions: parseRolePermissionsInput(parsed.data.permissions),
      responsibilities: parsed.data.responsibilities,
      scopes: parsed.data.scopes,
      teamScopedProjects: parsed.data.teamScopedProjects,
      teamScopedSeating: parsed.data.teamScopedSeating,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create role";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
