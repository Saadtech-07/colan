import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  countAllNotifications,
  countNotificationsForUser,
  filterNotificationsForViewer,
  getUnreadNotificationCount,
  listAllNotifications,
  listNotificationsForUser,
} from "@/lib/notifications-data";
import { requireNotificationActor } from "@/lib/notification-api";
import { canManageModule } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import type { AppRole } from "@/types";

export const dynamic = "force-dynamic";

function parseLimit(value: string | null, fallback = 50): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 200);
}

export async function GET(req: Request) {
  const actor = await requireNotificationActor();
  if (actor instanceof NextResponse) return actor;

  await ensureRoleRegistry();
  const session = await auth();
  const role = session?.user?.appRole as AppRole | undefined;
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const scopeAll = searchParams.get("scope") === "all";
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const canViewAll = canManageModule(role, "notifications");

  if (scopeAll && !canViewAll) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawNotifications =
    scopeAll && canViewAll
      ? await listAllNotifications(limit, unreadOnly)
      : await listNotificationsForUser(actor.id, limit, unreadOnly);

  const notifications = filterNotificationsForViewer(rawNotifications, actor.id);

  const totalCount =
    scopeAll && canViewAll
      ? await countAllNotifications()
      : await countNotificationsForUser(actor.id);

  const unreadCount = await getUnreadNotificationCount(actor.id);

  return NextResponse.json(
    {
      notifications,
      unreadCount,
      totalCount,
      scope: scopeAll && canViewAll ? "all" : "mine",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
