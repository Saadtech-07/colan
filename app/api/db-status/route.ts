import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataLayerSummary } from "@/lib/db-meta";

/** Confirms Atlas connectivity, ensures indexes / app user seed, and returns collection counts. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await getDataLayerSummary();
  return NextResponse.json(summary);
}
