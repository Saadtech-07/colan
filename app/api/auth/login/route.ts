import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { authCookieOptions } from "@/lib/auth/cookies";
import { signAuthToken } from "@/lib/auth/jwt";
import { buildJwtPayloadFromCredentials, toSession } from "@/lib/auth/user-token";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = await buildJwtPayloadFromCredentials(
    parsed.data.email,
    parsed.data.password,
  );
  if (!payload) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await signAuthToken(payload);
  const session = toSession(payload);
  const res = NextResponse.json({ user: session.user });
  res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
  return res;
}
