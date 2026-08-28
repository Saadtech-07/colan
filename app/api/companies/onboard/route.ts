import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { authCookieOptions } from "@/lib/auth/cookies";
import { signAuthToken } from "@/lib/auth/jwt";
import { buildJwtPayloadFromCredentials, toSession } from "@/lib/auth/user-token";
import { onboardCompany } from "@/lib/companies";

const onboardSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
});

/** Public: create a tenant workspace and first admin account. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = onboardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await onboardCompany(parsed.data);
    const payload = await buildJwtPayloadFromCredentials(
      parsed.data.adminEmail,
      parsed.data.adminPassword,
    );
    if (!payload) {
      return NextResponse.json(result, { status: 201 });
    }

    const token = await signAuthToken(payload);
    const session = toSession(payload);
    const res = NextResponse.json(
      { ...result, user: session.user },
      { status: 201 },
    );
    res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onboarding failed";
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
