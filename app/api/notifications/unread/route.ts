import { NextResponse } from "next/server";
import { getUnreadNotificationCount } from "@/lib/notifications-data";
import { requireNotificationActor } from "@/lib/notification-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireNotificationActor();
  if (actor instanceof NextResponse) return actor;

  const count = await getUnreadNotificationCount(actor.id);
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
