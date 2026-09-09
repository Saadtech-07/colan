import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformContext } from "@/lib/api/platform-context";
import {
  createCompanyForPlatform,
  listCompaniesForPlatform,
} from "@/lib/platform/companies-admin";

const createSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().max(120).optional(),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
});

export async function GET(req: Request) {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? undefined;
  const status = (url.searchParams.get("status") as "active" | "inactive" | "all" | null) ?? "all";

  const companies = await listCompaniesForPlatform({ search, status });
  return NextResponse.json({ companies });
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
    const result = await createCompanyForPlatform(parsed.data, {
      email: ctx.session.user.email,
      name: ctx.session.user.name ?? ctx.session.user.email,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unable to create company.";
    const status = msg.includes("already exists") || msg.includes("in use") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
