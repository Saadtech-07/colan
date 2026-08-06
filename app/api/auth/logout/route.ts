import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { clearAuthCookieOptions } from "@/lib/auth/cookies";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, "", clearAuthCookieOptions());
  return res;
}
