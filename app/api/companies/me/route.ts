import { NextResponse } from "next/server";
import { getCompanyById } from "@/lib/companies";
import { requireTenantContext } from "@/lib/api/tenant-context";

/** Current user's tenant workspace. */
export async function GET() {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;

  const company = await getCompanyById(ctx.companyId);
  if (!company) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json(company, { headers: { "Cache-Control": "no-store" } });
}
