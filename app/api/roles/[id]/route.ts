import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import {
  canAccessModuleAction,
  canManageModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { deleteWorkspaceRole, updateWorkspaceRole } from "@/lib/roles-data";
import {
  parseRolePermissionsInput,
  workspaceRoleUpdateSchema,
} from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (
    !canManageModule(roleKey, "roles") &&
    !canAccessModuleAction(roleKey, "roles", "editRoles") &&
    !canAccessModuleAction(roleKey, "roles", "managePermissions")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = workspaceRoleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updated = await updateWorkspaceRole(ctx.companyId, id, {
      ...parsed.data,
      permissions: parsed.data.permissions
        ? parseRolePermissionsInput(parsed.data.permissions)
        : undefined,
    });
    if (!updated) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update role";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (
    !canManageModule(roleKey, "roles") &&
    !canAccessModuleAction(roleKey, "roles", "deleteRoles")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const ok = await deleteWorkspaceRole(ctx.companyId, id);
    if (!ok) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete role";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
