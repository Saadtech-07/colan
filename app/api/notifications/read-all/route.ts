import { NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/lib/notifications-data";
import { requireNotificationActor } from "@/lib/notification-api";

export const dynamic = "force-dynamic";

export async function PATCH() {
  const actor = await requireNotificationActor();
  if (actor instanceof NextResponse) return actor;

  const updated = await markAllNotificationsRead(actor.id);
  return NextResponse.json({ updated });
}
