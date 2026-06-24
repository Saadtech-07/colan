"use client";

import * as React from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/page-typography";
import { NotificationListItem } from "@/components/notifications/notification-list-item";
import { parseApiError, useAppState } from "@/providers/app-state";
import type { NotificationDTO } from "@/models";

type NotificationsResponse = {
  notifications: NotificationDTO[];
  unreadCount: number;
  totalCount: number;
  scope: "all" | "mine";
};

export function NotificationsModule() {
  const { access } = useAppState();
  const canViewAll = access?.canManage("notifications") ?? false;
  const [scope, setScope] = React.useState<"all" | "mine">(canViewAll ? "all" : "mine");
  const [notifications, setNotifications] = React.useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadNotifications = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (scope === "all") params.set("scope", "all");
      const res = await fetch(`/api/notifications?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as NotificationsResponse;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setTotalCount(data.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  React.useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markRead = async (notification: NotificationDTO) => {
    if (notification.readAt) return;
    const res = await fetch(`/api/notifications/${notification.id}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) return;
    const updated = (await res.json()) as NotificationDTO;
    setNotifications((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle as="h2">Notifications</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === "all"
              ? "Activity alerts across all workspace users."
              : "Your personal alerts from projects, tasks, and daily updates."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canViewAll ? (
            <div className="inline-flex rounded-xl border border-border/70 bg-background/80 p-1">
              <Button
                type="button"
                size="sm"
                variant={scope === "all" ? "default" : "ghost"}
                className="h-8 rounded-lg px-3 text-xs"
                onClick={() => setScope("all")}
              >
                All users
              </Button>
              <Button
                type="button"
                size="sm"
                variant={scope === "mine" ? "default" : "ghost"}
                className="h-8 rounded-lg px-3 text-xs"
                onClick={() => setScope("mine")}
              >
                My inbox
              </Button>
            </div>
          ) : null}
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur-xl">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notifications…
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-center text-sm text-destructive">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No notifications yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Project assignments, task updates, and daily update alerts will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {notifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  showRecipient={scope === "all"}
                  onNavigate={(item) => void markRead(item)}
                  className="rounded-none hover:bg-muted/40"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && !error && totalCount > notifications.length ? (
        <p className="text-center text-xs text-muted-foreground">
          Showing latest {notifications.length} of {totalCount} notifications.
        </p>
      ) : null}
    </div>
  );
}
