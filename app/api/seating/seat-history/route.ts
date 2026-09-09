import { NextResponse } from "next/server";
<<<<<<< HEAD
<<<<<<< HEAD
import { auth } from "@/auth";
=======
import { requireTenantContext } from "@/lib/api/tenant-context";
>>>>>>> origin/dev-2
=======
import { auth } from "@/auth";
>>>>>>> ad39d2f479f650adb130753c6a91ced318b9aae1
import { listSeatHistory } from "@/lib/seating-seat-history";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";

export async function GET(req: Request) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> ad39d2f479f650adb130753c6a91ced318b9aae1
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
<<<<<<< HEAD
=======
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;
>>>>>>> origin/dev-2
=======
>>>>>>> ad39d2f479f650adb130753c6a91ced318b9aae1

  const url = new URL(req.url);
  const officeSlug = normalizeOfficeSlug(url.searchParams.get("officeSlug"));
  const seatId = url.searchParams.get("seatId")?.trim() ?? "";
  if (!seatId) {
    return NextResponse.json({ error: "seatId is required" }, { status: 400 });
  }

  try {
<<<<<<< HEAD
<<<<<<< HEAD
    const entries = await listSeatHistory(officeSlug, seatId);
=======
    const entries = await listSeatHistory(ctx.companyId, officeSlug, seatId);
>>>>>>> origin/dev-2
=======
    const entries = await listSeatHistory(officeSlug, seatId);
>>>>>>> ad39d2f479f650adb130753c6a91ced318b9aae1
    return NextResponse.json({ entries });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load seat history";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
