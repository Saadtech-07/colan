import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformContext } from "@/lib/api/platform-context";
import {
  getCompanyDetailForPlatform,
  updateCompanyForPlatform,
} from "@/lib/platform/companies-admin";

type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().max(120).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(_req: Request, { params }: RouteParams) {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const company = await getCompanyDetailForPlatform(id);
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  return NextResponse.json({ company });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const company = await updateCompanyForPlatform(id, parsed.data, {
      email: ctx.session.user.email,
      name: ctx.session.user.name ?? ctx.session.user.email,
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }
    return NextResponse.json({ company });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unable to update company.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
