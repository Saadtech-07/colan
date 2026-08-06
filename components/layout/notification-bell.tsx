"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationListItem } from "@/components/notifications/notification-list-item";
import { dedupeAsync } from "@/lib/dedupe-async";
import { cn } from "@/lib/utils";
import { parseApiError } from "@/providers/app-state";
import type { NotificationDTO } from "@/models";

const POLL_MS = 45_000;
const PREVIEW_LIMIT = 2;
const PREVIEW_TTL_MS = 8_000;
const PREVIEW_CACHE_KEY = `notifications:preview:limit=${PREVIEW_LIMIT}&unreadOnly=true`;

type NotificationsResponse = {
  notifications: NotificationDTO[];
  unreadCount: number;
  totalCount: number;
};

let previewCache: { at: number; data: NotificationsResponse } | null = null;

async function fetchNotificationPreview(opts?: {
  force?: boolean;
}): Promise<NotificationsResponse> {
  if (
    !opts?.force &&
    previewCache &&
    Date.now() - previewCache.at < PREVIEW_TTL_MS
  ) {
    return previewCache.data;
  }

  return dedupeAsync(PREVIEW_CACHE_KEY, async () => {
    const res = await fetch(
      `/api/notifications?limit=${PREVIEW_LIMIT}&unreadOnly=true`,
      {
        credentials: "include",
        cache: "no-store",
      },
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        const empty = { notifications: [], unreadCount: 0, totalCount: 0 };
        previewCache = { at: Date.now(), data: empty };
        return empty;
      }
      throw new Error(await parseApiError(res));
    }
    const data = (await res.json()) as NotificationsResponse;
    previewCache = { at: Date.now(), data };
    return data;
  });
}

function invalidatePreviewCache() {
  previewCache = null;
}

export function NotificationBell() {
  const [notifications, setNotifications] = React.useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const applyPreview = React.useCallback((data: NotificationsResponse) => {
    setNotifications(data.notifications);
    setUnreadCount(data.notifications.length === 0 ? 0 : data.unreadCount);
    setTotalCount(data.totalCount);
    setError(null);
  }, []);

  const refreshNotifications = React.useCallback(
    async (opts?: { force?: boolean }) => {
      try {
        const data = await fetchNotificationPreview(opts);
        applyPreview(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load notifications");
      }
    },
    [applyPreview],
  );

  React.useEffect(() => {
    void refreshNotifications();
    const timer = window.setInterval(() => {
      void refreshNotifications({ force: true });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshNotifications]);

  const removeFromPopup = React.useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
  }, []);

  const markRead = async (notification: NotificationDTO) => {
    removeFromPopup(notification.id);

    if (notification.readAt) return;

    const res = await fetch(`/api/notifications/${notification.id}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) {
      setNotifications((prev) => {
        if (prev.some((item) => item.id === notification.id)) return prev;
        return [notification, ...prev].slice(0, PREVIEW_LIMIT);
      });
      return;
    }

    invalidatePreviewCache();
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const markAllRead = async () => {
    const res = await fetch("/api/notifications/read-all", {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) return;
    invalidatePreviewCache();
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;
    // Single refresh on open (removed duplicate useEffect that also refreshed).
    setLoading(true);
    void refreshNotifications({ force: true }).finally(() => setLoading(false));
  };

  const showViewAll = notifications.length > 0;
  const popupEmptyMessage =
    totalCount === 0 ? "No notifications yet." : "No new notifications.";

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground sm:h-10 sm:w-10"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-1.5rem,27rem)] overflow-hidden rounded-[1.75rem] border-0 p-0 shadow-lg"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <DropdownMenuLabel className="p-0 font-heading text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-foreground">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && notifications.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-normal"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-[min(20rem,55vh)] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : error ? (
            <p className="px-6 py-8 text-center text-sm text-destructive">{error}</p>
          ) : notifications.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {popupEmptyMessage}
            </p>
          ) : (
            <div className="px-3 py-2">
              {notifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={cn(
                    index < notifications.length - 1 &&
                      "mb-3 border-b border-border/50 pb-3",
                  )}
                >
                  <DropdownMenuItem
                    className="cursor-pointer rounded-none p-0 focus:bg-transparent"
                    asChild
                  >
                    <NotificationListItem
                      notification={notification}
                      variant="compact"
                      onNavigate={(item) => {
                        void markRead(item);
                        setOpen(false);
                      }}
                    />
                  </DropdownMenuItem>
                </div>
              ))}
            </div>
          )}
        </div>

        {showViewAll ? (
          <div className="px-6 py-5">
            <Button
              variant="outline"
              size="sm"
              className="h-11 w-full rounded-full border-border/70 text-sm font-normal"
              asChild
            >
              <Link href="/notifications" onClick={() => setOpen(false)}>
                View all
              </Link>
            </Button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
