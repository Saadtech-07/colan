import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canViewModule, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import {
  ACCESS_LEVEL_OPTIONS,
  modulePermissionToAccessLevel,
} from "@/lib/rbac-access-levels";
import {
  MODULE_PERMISSION_CATALOG,
  RBAC_MODULES,
  type RbacModule,
} from "@/lib/rbac-modules";

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

  const modules = RBAC_MODULES.map((module) => ({
    key: module,
    title: MODULE_PERMISSION_CATALOG[module].title,
    description: MODULE_PERMISSION_CATALOG[module].description,
    actions: MODULE_PERMISSION_CATALOG[module].actions.map((action) => ({
      key: action.key,
      label: action.label,
      description: action.description,
    })),
  }));

  return NextResponse.json({
    accessLevels: ACCESS_LEVEL_OPTIONS,
    modules,
  });
}
