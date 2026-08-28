import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { getSeatingVersion } from "@/lib/seating-versions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  try {
    const version = await getSeatingVersion(ctx.companyId, id);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    return NextResponse.json(version);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load version";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
