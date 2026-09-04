import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session?.user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: session.user });
}
