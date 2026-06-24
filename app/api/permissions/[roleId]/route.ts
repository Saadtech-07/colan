import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageModule, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { updateWorkspaceRole } from "@/lib/roles-data";
import { accessLevelToModulePermission } from "@/lib/rbac-access-levels";
import {
  emptyModulePermissions,
  normalizeModulePermissions,
  RBAC_MODULES,
  type RbacModule,
} from "@/lib/rbac-modules";
import type { PermissionAccessLevel } from "@/types";
import { z } from "zod";

type Params = { params: Promise<{ roleId: string }> };

const permissionsPutSchema = z.object({
  modules: z.record(
    z.string(),
    z.enum(["none", "view", "edit", "full"] as [PermissionAccessLevel, ...PermissionAccessLevel[]]),
  ),
});

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (!canManageModule(roleKey, "roles")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { roleId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = permissionsPutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const base = emptyModulePermissions();
  for (const module of RBAC_MODULES) {
    const level = parsed.data.modules[module] as PermissionAccessLevel | undefined;
    if (!level) continue;
    base[module] = accessLevelToModulePermission(module, level, base[module]);
  }

  const updated = await updateWorkspaceRole(roleId, { permissions: base });
  if (!updated) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
