import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  assignEmployeeToBay,
  createEmployee,
  listEmployees,
} from "@/lib/data-service";
import { DataBackendError } from "@/lib/data-backend";
import {
  canAccessModuleAction,
  canAssignSeating,
  canManageModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { bayAssignSchema, employeeCreateSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const employees = await listEmployees();
    return NextResponse.json(employees);  
  } catch (e) {
    if (e instanceof DataBackendError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (
    !canManageModule(roleKey, "teamMembers") &&
    !canAccessModuleAction(roleKey, "teamMembers", "create")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = employeeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const created = await createEmployee(parsed.data);
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (!canAssignSeating(roleKey)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bayAssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { bayId, employeeId, officeSlug } = parsed.data;
  if (employeeId) {
    if (!ObjectId.isValid(employeeId)) {
      return NextResponse.json({ error: "Invalid employee id" }, { status: 400 });
    }
  }
  try {
    await assignEmployeeToBay(bayId, employeeId, officeSlug);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Assign failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const employees = await listEmployees();
  return NextResponse.json(employees);
}
