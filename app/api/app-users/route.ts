import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { createAppUser, listAppUsers } from "@/lib/app-users";
import { resolveLoginUrl } from "@/lib/email";
import { generateTemporaryPassword } from "@/lib/password-utils";
import {
  canAccessModuleAction,
  canManageModule,
  canViewModule,
  normalizeAppRole,
  roleNeedsEmployeeIdentity,
} from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { sendAccountCreatedEmail } from "@/services/email-service";
import { appUserCreateSchema } from "@/lib/validations";

export async function GET() {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (!canViewModule(roleKey, "appUsers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await listAppUsers(ctx.companyId);
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
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

  try {
    const temporaryPassword =
      payload.password?.trim() && payload.password.trim().length >= 6
        ? payload.password.trim()
        : generateTemporaryPassword();

    const created = await createAppUser(ctx.companyId, {
      email: payload.email,
      personalEmail: payload.personalEmail,
      password: temporaryPassword,
      name: payload.name,
      appRole: payload.appRole,
      ...(roleNeedsEmployeeIdentity(payload.appRole)
        ? {
            team: payload.team as NonNullable<typeof payload.team>,
            employeeId: payload.employeeId ?? "",
          }
        : {}),
      imageUrl: payload.imageUrl,
      workEmail: payload.workEmail || payload.email,
      phone: payload.phone,
      location: payload.location,
      joinedDate: payload.joinedDate,
      notes: payload.notes,
      bayNumber: payload.bayNumber,
    });
    const loginUrl = resolveLoginUrl(new URL(req.url).origin);
    const loginEmail = payload.email.toLowerCase().trim();
    const personalEmail = payload.personalEmail.toLowerCase().trim();
    const emailDelivery =
      loginUrl
        ? await sendAccountCreatedEmail({
            employeeName: payload.name.trim(),
            recipientEmail: personalEmail,
            loginEmail,
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
