import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPlatformSessionUser } from "@/lib/platform/platform-users";
import type { Session } from "@/types/auth";

export type PlatformContext = {
  session: Session;
};

export async function requirePlatformContext(): Promise<PlatformContext | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPlatformSessionUser(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { session };
}
