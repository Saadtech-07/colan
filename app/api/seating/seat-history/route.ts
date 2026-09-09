import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { listSeatHistory } from "@/lib/seating-seat-history";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";

export async function GET(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const officeSlug = normalizeOfficeSlug(url.searchParams.get("officeSlug"));
  const seatId = url.searchParams.get("seatId")?.trim() ?? "";
  if (!seatId) {
    return NextResponse.json({ error: "seatId is required" }, { status: 400 });
  }

  try {
    const entries = await listSeatHistory(ctx.companyId, officeSlug, seatId);
    return NextResponse.json({ entries });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load seat history";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
