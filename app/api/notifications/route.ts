import { NextResponse } from "next/server";
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

  const role = actor.appRole as AppRole | undefined;
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const scopeAll = searchParams.get("scope") === "all";
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const canViewAll = canManageModule(role, "notifications");
  const badgePreview = unreadOnly && !scopeAll && limit <= 5;

  if (scopeAll && !canViewAll) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const listPromise =
    scopeAll && canViewAll
      ? listAllNotifications(limit, unreadOnly)
      : listNotificationsForUser(actor.id, limit, unreadOnly);

  const [rawNotifications, totalCount, unreadCount] = await Promise.all([
    listPromise,
    badgePreview
      ? Promise.resolve(0)
      : scopeAll && canViewAll
        ? countAllNotifications()
        : countNotificationsForUser(actor.id),
    getUnreadNotificationCount(actor.id),
  ]);

  const notifications = filterNotificationsForViewer(rawNotifications, actor.id);

  return NextResponse.json(
    {
      notifications,
      unreadCount,
      totalCount: badgePreview ? unreadCount : totalCount,
      scope: scopeAll && canViewAll ? "all" : "mine",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
