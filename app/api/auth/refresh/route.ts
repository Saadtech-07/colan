import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { authCookieOptions } from "@/lib/auth/cookies";
import { signAuthToken } from "@/lib/auth/jwt";
import { refreshJwtPayload, toSession } from "@/lib/auth/user-token";

/** Re-issue JWT from the latest user record (profile / role changes). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await refreshJwtPayload(session.user.email);
  if (!payload) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const token = await signAuthToken(payload);
  const next = toSession(payload);
  const res = NextResponse.json({ user: next.user });
  res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
  return res;
}
