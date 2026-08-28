import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { refreshSessionCookieIfStale } from "@/lib/auth/session";

export async function GET() {
  await refreshSessionCookieIfStale();
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: session.user });
}
