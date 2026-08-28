import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { listSeatingVersions, saveSeatingVersion } from "@/lib/seating-versions";
import { canAssignSeating, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { seatingVersionSaveSchema } from "@/lib/validations";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";

export async function GET(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const officeSlug = normalizeOfficeSlug(
    new URL(req.url).searchParams.get("officeSlug"),
  );
  try {
    const versions = await listSeatingVersions(ctx.companyId, officeSlug);
    return NextResponse.json({ versions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load versions";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (!canAssignSeating(roleKey)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = seatingVersionSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await saveSeatingVersion({
      companyId: ctx.companyId,
      officeSlug: parsed.data.officeSlug,
      changes: parsed.data.changes,
      actor: {
        userId: ctx.session.user.id,
        name: ctx.session.user.name?.trim() || ctx.session.user.email,
        email: ctx.session.user.email,
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
