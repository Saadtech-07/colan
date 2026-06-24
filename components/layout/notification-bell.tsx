"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Briefcase, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatChatTime } from "@/lib/chat-client";
import { cn } from "@/lib/utils";
import { parseApiError } from "@/providers/app-state";
import type { NotificationDTO } from "@/models";

const POLL_MS = 45_000;

export function NotificationBell() {
  const [notifications, setNotifications] = React.useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) return;
        throw new Error(await parseApiError(res));
      }
      const data = (await res.json()) as {
        notifications: NotificationDTO[];
        unreadCount: number;
      };
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    }
  }, []);

  const refreshUnreadOnly = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { count: number };
      setUnreadCount(data.count);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    void refreshNotifications();
    const timer = window.setInterval(() => {
      void refreshUnreadOnly();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshNotifications, refreshUnreadOnly]);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    void refreshNotifications().finally(() => setLoading(false));
  }, [open, refreshNotifications]);

  const markRead = async (notification: NotificationDTO) => {
    if (notification.readAt) return;
    const res = await fetch(`/api/notifications/${notification.id}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) return;
    const updated = (await res.json()) as NotificationDTO;
    setNotifications((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const markAllRead = async () => {
    const res = await fetch("/api/notifications/read-all", {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) return;
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, readAt: item.readAt ?? now })),
    );
    setUnreadCount(0);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;
    void refreshNotifications();
  };

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
        className="w-[min(100vw-1.5rem,22rem)] rounded-2xl p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-2 text-xs"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>

        <ScrollArea className="max-h-[min(24rem,60vh)]">
          {loading && notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : error ? (
            <p className="px-4 py-6 text-center text-sm text-destructive">{error}</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => {
                const content = (
                  <div className="flex w-full items-start gap-3">
                    <NotificationRow notification={notification} />
                  </div>
                );

                if (notification.projectSlug) {
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className={cn(
                        "cursor-pointer rounded-none px-3 py-3 focus:bg-muted/60",
                        !notification.readAt && "bg-primary/5",
                      )}
                      asChild
                    >
                      <Link
                        href={`/projects/${notification.projectSlug}`}
                        onClick={() => void markRead(notification)}
                      >
                        {content}
                      </Link>
                    </DropdownMenuItem>
                  );
                }

                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      "cursor-pointer rounded-none px-3 py-3 focus:bg-muted/60",
                      !notification.readAt && "bg-primary/5",
                    )}
                    onClick={() => void markRead(notification)}
                  >
                    {content}
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({ notification }: { notification: NotificationDTO }) {
  return (
    <>
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          notification.readAt ? "bg-muted" : "bg-primary/10 text-primary",
        )}
      >
        <Briefcase className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug text-foreground">
            {notification.title}
          </p>
          {!notification.readAt ? (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {notification.message}
        </p>
        <p className="text-[10px] text-muted-foreground/80">
          {formatChatTime(notification.createdAt)}
        </p>
      </div>
    </>
  );
}
