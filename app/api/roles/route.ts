import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import {
  canAccessModuleAction,
  canManageModule,
  canViewModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { createWorkspaceRole } from "@/lib/roles-data";
import {
  parseRolePermissionsInput,
  workspaceRoleCreateSchema,
} from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const registry = await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (!canViewModule(roleKey, "roles")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sorted = [...registry.values()].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
  return NextResponse.json(sorted, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
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
    const created = await createWorkspaceRole(ctx.companyId, {
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
