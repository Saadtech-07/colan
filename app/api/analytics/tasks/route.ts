import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sessionAccessAsync } from "@/lib/session-access";
import { getTaskAnalytics } from "@/lib/analytics-data";

export async function GET() {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analytics = await getTaskAnalytics(access.role, access.team);
  return NextResponse.json(analytics, { headers: { "Cache-Control": "no-store" } });
}
