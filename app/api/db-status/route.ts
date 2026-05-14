import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataLayerSummary } from "@/lib/db-meta";

/** Confirms Atlas connectivity and collection counts (no seeding). */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await getDataLayerSummary();
  return NextResponse.json(summary);
}
