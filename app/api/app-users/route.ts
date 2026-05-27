import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAppUser, listAppUsers } from "@/lib/app-users";
import { resolveLoginUrl } from "@/lib/email";
import { generateTemporaryPassword } from "@/lib/password-utils";
import {
  canAccessModuleAction,
  canManageModule,
  canViewModule,
  normalizeAppRole,
  roleNeedsTeam,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { sendAccountCreatedEmail } from "@/services/email-service";
import { appUserCreateSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (!canViewModule(roleKey, "appUsers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await listAppUsers();
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (
    !canManageModule(roleKey, "appUsers") &&
    !canAccessModuleAction(roleKey, "appUsers", "create")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = appUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  if (roleNeedsTeam(payload.appRole) && !payload.team) {
    return NextResponse.json(
      { error: "Team is required for lead and employee roles." },
      { status: 400 },
    );
  }

  try {
    const temporaryPassword =
      payload.password?.trim() && payload.password.trim().length >= 6
        ? payload.password.trim()
        : generateTemporaryPassword();

    const created = await createAppUser({
      ...payload,
      password: temporaryPassword,
    });
    const loginUrl = resolveLoginUrl(new URL(req.url).origin);
    const emailDelivery =
      loginUrl
        ? await sendAccountCreatedEmail({
            employeeName: payload.name.trim(),
            employeeEmail: payload.email.toLowerCase().trim(),
            temporaryPassword,
            loginUrl,
          })
        : {
            attempted: false,
            sent: false,
            provider: "nodemailer" as const,
            message: "Login URL could not be resolved.",
          };

    return NextResponse.json({ ...created, emailDelivery }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create account" },
      { status: 400 },
    );
  }
}
