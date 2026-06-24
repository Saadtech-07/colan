import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  canAccessModuleAction,
  canManageModule,
  canViewModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { filterEmployeesForUser, sessionAccessAsync } from "@/lib/session-access";
import { deletePerson, getPersonById, updatePerson } from "@/lib/people-data";
import { z } from "zod";
import type { CompanyRole, Gender, PersonStatus } from "@/types";

type Params = { params: Promise<{ id: string }> };

const personUpdateSchema = z.object({
  employeeId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  team: z.string().min(1).optional(),
  role: z.enum(["Admin", "Manager", "Team Lead", "Employee", "Intern"] as [
    CompanyRole,
    ...CompanyRole[],
  ]).optional(),
  gender: z.enum(["male", "female", "other"] as [Gender, ...Gender[]]).optional(),
  bayNumber: z.string().optional(),
  imageUrl: z.string().optional(),
  email: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  status: z.enum(["Active", "On Leave", "Inactive"] as [PersonStatus, ...PersonStatus[]]).optional(),
  reportingManagerId: z.string().nullable().optional(),
  directory: z.record(z.string(), z.unknown()).optional(),
});

async function assertPersonVisible(id: string, access: NonNullable<Awaited<ReturnType<typeof sessionAccessAsync>>>) {
  const person = await getPersonById(id);
  if (!person) return { error: NextResponse.json({ error: "Person not found" }, { status: 404 }) };
  const scoped = filterEmployeesForUser([person], access.role, access.team);
  if (scoped.length === 0) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { person };
}

export async function GET(_req: Request, { params }: Params) {
  const access = await sessionAccessAsync(await auth());
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(access.role);
  if (!canViewModule(roleKey, "peopleDirectory") && !canViewModule(roleKey, "teamMembers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await assertPersonVisible(id, access);
  if ("error" in result) return result.error;
  return NextResponse.json(result.person);
}

export async function PUT(req: Request, { params }: Params) {
  const access = await sessionAccessAsync(await auth());
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(access.role);
  if (
    !canManageModule(roleKey, "peopleDirectory") &&
    !canAccessModuleAction(roleKey, "peopleDirectory", "edit") &&
    !canManageModule(roleKey, "teamMembers") &&
    !canAccessModuleAction(roleKey, "teamMembers", "edit")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const visible = await assertPersonVisible(id, access);
  if ("error" in visible) return visible.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = personUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updatePerson(id, {
    ...parsed.data,
    reportingManagerId: parsed.data.reportingManagerId ?? undefined,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const access = await sessionAccessAsync(await auth());
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(access.role);
  if (
    !canManageModule(roleKey, "peopleDirectory") &&
    !canAccessModuleAction(roleKey, "peopleDirectory", "delete") &&
    !canManageModule(roleKey, "teamMembers") &&
    !canAccessModuleAction(roleKey, "teamMembers", "delete")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const visible = await assertPersonVisible(id, access);
  if ("error" in visible) return visible.error;

  const ok = await deletePerson(id);
  if (!ok) return NextResponse.json({ error: "Failed to delete person" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
