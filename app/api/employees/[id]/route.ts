import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteEmployee,
  getEmployeeDetailBySlugOrId,
  listEmployees,
  updateEmployee,
} from "@/lib/data-service";
import { findEmployeeBySlugOrId } from "@/lib/employee-slug";
import {
  canManageModule,
  filterEmployeesForUser,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { sessionAccessAsync } from "@/lib/session-access";
import { employeeUpdateSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id: slugOrId } = await params;
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const detail = await getEmployeeDetailBySlugOrId(slugOrId);
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
  const { id: slugOrId } = await params;
  const id = await resolveEmployeeMongoId(slugOrId);
  if (!id) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureRoleRegistry();
  if (!canManageModule(normalizeAppRole(session.user.appRole), "teamMembers")) {
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
    const updated = await updateEmployee(id, parsed.data);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}

async function resolveEmployeeMongoId(slugOrId: string): Promise<string | null> {
  const employees = await listEmployees();
  return findEmployeeBySlugOrId(employees, slugOrId)?.id ?? null;
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const { id: slugOrId } = await params;
  const id = await resolveEmployeeMongoId(slugOrId);
  if (!id) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureRoleRegistry();
  if (!canManageModule(normalizeAppRole(session.user.appRole), "teamMembers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteEmployee(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 400 });
  }
}
