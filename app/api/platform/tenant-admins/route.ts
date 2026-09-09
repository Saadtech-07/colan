import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformContext } from "@/lib/api/platform-context";
import {
  createTenantAdminForCompany,
  listTenantAdminsForPlatform,
  setTenantAdminActive,
} from "@/lib/platform/companies-admin";
import { writePlatformAuditLog } from "@/lib/platform/platform-audit";

const createSchema = z.object({
  companyId: z.string().min(1),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
});

export async function GET(req: Request) {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? undefined;
  const companyId = url.searchParams.get("companyId") ?? undefined;

  const admins = await listTenantAdminsForPlatform({ search, companyId });
  return NextResponse.json({ admins });
}

export async function POST(req: Request) {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const admin = await createTenantAdminForCompany(parsed.data);
    await writePlatformAuditLog({
      actorEmail: ctx.session.user.email,
      actorName: ctx.session.user.name ?? ctx.session.user.email,
      action: "tenant_admin.created",
      resourceType: "tenant_admin",
      resourceId: admin.id,
      companyId: admin.companyId,
    });
    return NextResponse.json({ admin }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unable to create tenant admin.";
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: Request) {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = z
    .object({
      id: z.string().min(1),
      isActive: z.boolean(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const ok = await setTenantAdminActive(parsed.data.id, parsed.data.isActive, {
    email: ctx.session.user.email,
    name: ctx.session.user.name ?? ctx.session.user.email,
  });
  if (!ok) {
    return NextResponse.json({ error: "Tenant admin not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
