import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listSeatingVersions, saveSeatingVersion } from "@/lib/seating-versions";
import { canAssignSeating, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { seatingVersionSaveSchema } from "@/lib/validations";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const officeSlug = normalizeOfficeSlug(
    new URL(req.url).searchParams.get("officeSlug"),
  );
  try {
    const versions = await listSeatingVersions(officeSlug);
    return NextResponse.json({ versions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load versions";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

export async function POST(req: Request) {
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

  const parsed = seatingVersionSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await saveSeatingVersion({
      officeSlug: parsed.data.officeSlug,
      changes: parsed.data.changes,
      actor: {
        userId: session.user.id,
        name: session.user.name?.trim() || session.user.email,
        email: session.user.email,
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
