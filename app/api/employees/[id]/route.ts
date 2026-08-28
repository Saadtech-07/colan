import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import {
  deleteEmployee,
  getEmployeeDetailBySlugOrId,
  listEmployees,
  updateEmployee,
} from "@/lib/data-service";
import { findEmployeeBySlugOrId } from "@/lib/employee-slug";
import {
  canAccessModuleAction,
  canManageModule,
  filterEmployeesForUser,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { sessionAccessAsync } from "@/lib/session-access";
import { employeeUpdateSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const { id: slugOrId } = await params;
  const access = await sessionAccessAsync(ctx.session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const detail = await getEmployeeDetailBySlugOrId(ctx.companyId, slugOrId);
  if (!detail) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const visible = filterEmployeesForUser([detail], access.role, access.team);
  if (visible.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const { id: slugOrId } = await params;
  const id = await resolveEmployeeMongoId(ctx.companyId, slugOrId);
  if (!id) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (
    !canManageModule(roleKey, "teamMembers") &&
    !canAccessModuleAction(roleKey, "teamMembers", "edit")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = employeeUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await updateEmployee(ctx.companyId, id, parsed.data);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}

async function resolveEmployeeMongoId(companyId: string, slugOrId: string): Promise<string | null> {
  const employees = await listEmployees({ companyId });
  return findEmployeeBySlugOrId(employees, slugOrId)?.id ?? null;
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const { id: slugOrId } = await params;
  const id = await resolveEmployeeMongoId(ctx.companyId, slugOrId);
  if (!id) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (
    !canManageModule(roleKey, "teamMembers") &&
    !canAccessModuleAction(roleKey, "teamMembers", "delete")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteEmployee(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 400 });
  }
}
