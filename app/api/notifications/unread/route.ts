import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUnreadNotificationCount } from "@/lib/notifications-data";
import { requireNotificationActor } from "@/lib/notification-api";
import { canViewModule } from "@/lib/permissions";
import type { AppRole } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireNotificationActor();
  if (actor instanceof NextResponse) return actor;

  const session = await auth();
  const role = session?.user?.appRole as AppRole | undefined;
  if (!role || !canViewModule(role, "notifications")) {
    return NextResponse.json({ count: 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  const count = await getUnreadNotificationCount(actor.id);
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
