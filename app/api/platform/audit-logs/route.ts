import { NextResponse } from "next/server";
import { requirePlatformContext } from "@/lib/api/platform-context";
import { listPlatformAuditLogs } from "@/lib/platform/platform-audit";

export async function GET(req: Request) {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const logs = await listPlatformAuditLogs({ limit });
  return NextResponse.json({ logs });
}
