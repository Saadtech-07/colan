import { NextResponse } from "next/server";
import { requirePlatformContext } from "@/lib/api/platform-context";
import { getPlatformDashboardStats } from "@/lib/platform/companies-admin";

export async function GET() {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;
  const stats = await getPlatformDashboardStats();
  return NextResponse.json(stats);
}
