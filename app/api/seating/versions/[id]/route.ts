import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSeatingVersion } from "@/lib/seating-versions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const version = await getSeatingVersion(id);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    return NextResponse.json(version);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load version";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
