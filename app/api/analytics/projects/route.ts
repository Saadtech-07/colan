import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sessionAccessAsync } from "@/lib/session-access";
import { getProjectAnalytics } from "@/lib/analytics-data";

export async function GET() {
  const session = await auth();
  const access = await sessionAccessAsync(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized analytics data is not available" }, { status: 401 });
  }

  const analytics = await getProjectAnalytics(access.role, access.team);
  return NextResponse.json(analytics, { headers: { "Cache-Control": "no-store" } });
}
