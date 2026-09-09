import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import {
  canAccessModuleAction,
  canManageModule,
  canViewModule,
  normalizeAppRole,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { filterEmployeesForUser, sessionAccessAsync } from "@/lib/session-access";
import {
  createPerson,
  listPeople,
  type PersonListFilters,
} from "@/lib/people-data";
import { employeeCreateSchema } from "@/lib/validations";
import { z } from "zod";
import type { PersonStatus } from "@/types";

const personCreateSchema = employeeCreateSchema.extend({
  department: z.string().optional(),
  designation: z.string().optional(),
  status: z.enum(["Active", "On Leave", "Inactive"]).optional(),
  reportingManagerId: z.string().optional(),
});

export async function GET(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const access = await sessionAccessAsync(ctx.session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(access.role);
  if (!canViewModule(roleKey, "peopleDirectory") && !canViewModule(roleKey, "teamMembers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filters: PersonListFilters = {
    search: url.searchParams.get("search") ?? undefined,
    department: url.searchParams.get("department") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    location: url.searchParams.get("location") ?? undefined,
    reportingManagerId: url.searchParams.get("reportingManagerId") ?? undefined,
    status: (url.searchParams.get("status") as PersonStatus | null) ?? undefined,
  };

  let people = await listPeople(ctx.companyId, filters);
  const scopedEmployees = filterEmployeesForUser(
    people,
    access.role,
    access.team,
  );
  const allowedIds = new Set(scopedEmployees.map((employee) => employee.id));
  people = people.filter((person) => allowedIds.has(person.id));

  return NextResponse.json(people, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const access = await sessionAccessAsync(ctx.session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(access.role);
  if (
    !canManageModule(roleKey, "peopleDirectory") &&
    !canAccessModuleAction(roleKey, "peopleDirectory", "create") &&
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

  const parsed = personCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const created = await createPerson(ctx.companyId, parsed.data);
  return NextResponse.json(created, { status: 201 });
}
