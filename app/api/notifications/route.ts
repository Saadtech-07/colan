import { NextResponse } from "next/server";
import {
  getUnreadNotificationCount,
  listNotificationsForUser,
} from "@/lib/notifications-data";
import { requireNotificationActor } from "@/lib/notification-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireNotificationActor();
  if (actor instanceof NextResponse) return actor;

  const notifications = await listNotificationsForUser(actor.id);
  const unreadCount = await getUnreadNotificationCount(actor.id);

  return NextResponse.json(
    { notifications, unreadCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
