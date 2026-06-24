import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notifications-data";
import { requireNotificationActor } from "@/lib/notification-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  const actor = await requireNotificationActor();
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const updated = await markNotificationRead(id, actor.id);
  if (!updated) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
