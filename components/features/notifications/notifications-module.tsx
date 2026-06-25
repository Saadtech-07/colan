"use client";

import * as React from "react";
import { Bell, CheckCheck, Loader2, MessageCircle, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/page-typography";
import { NotificationListItem } from "@/components/notifications/notification-list-item";
import { notificationTypeLabel } from "@/lib/notification-routing";
import { parseApiError, useAppState } from "@/providers/app-state";
import type { NotificationDTO } from "@/models";

type NotificationsResponse = {
  notifications: NotificationDTO[];
  unreadCount: number;
  totalCount: number;
  scope: "all" | "mine";
};

type NotificationView = "all" | "messages" | "mine";

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function notificationMatchesView(
  notification: NotificationDTO,
  view: NotificationView,
): boolean {
  if (view === "messages") return notification.type === "message_received";
  return true;
}

function notificationMatchesDateFilter(
  notification: NotificationDTO,
  filterDate: string,
): boolean {
  if (!filterDate) return true;

  const createdDate = notification.createdAt.slice(0, 10);
  if (createdDate === filterDate) return true;

  if (notification.type === "daily_update_submitted") {
    return notification.message.includes(`on ${filterDate}`);
  }

  return false;
}

function notificationSearchHaystack(notification: NotificationDTO): string {
  return [
    notification.title,
    notification.message,
    notification.actorName,
    notification.recipientName,
    notification.projectName,
    notification.taskTitle,
    notificationTypeLabel(notification.type),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function notificationMatchesSearchFilter(
  notification: NotificationDTO,
  employeeSearch: string,
): boolean {
  if (!employeeSearch.trim()) return true;
  const needle = employeeSearch.trim().toLowerCase();
  return notificationSearchHaystack(notification).includes(needle);
}

function notificationMatchesFilters(
  notification: NotificationDTO,
  view: NotificationView,
  employeeSearch: string,
  filterDate: string,
): boolean {
  if (!notificationMatchesView(notification, view)) return false;
  if (!notificationMatchesDateFilter(notification, filterDate)) return false;
  if (!notificationMatchesSearchFilter(notification, employeeSearch)) return false;
  return true;
}

const VIEW_OPTIONS: Array<{ id: NotificationView; label: string; adminOnly?: boolean }> = [
  { id: "all", label: "All users", adminOnly: true },
  { id: "messages", label: "Messages" },
  { id: "mine", label: "My inbox" },
];

export function NotificationsModule() {
  const { access } = useAppState();
  const canViewAll = access?.canManage("notifications") ?? false;
  const [view, setView] = React.useState<NotificationView>(canViewAll ? "all" : "mine");
  const [employeeSearch, setEmployeeSearch] = React.useState("");
  const [filterDate, setFilterDate] = React.useState("");
  const [notifications, setNotifications] = React.useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadNotifications = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const useAllScope = view === "all" || (view === "messages" && canViewAll);
      const params = new URLSearchParams({ limit: "100" });
      if (useAllScope) params.set("scope", "all");
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
  }, [canViewAll, view]);

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

  const filteredNotifications = React.useMemo(() => {
    return notifications.filter((notification) =>
      notificationMatchesFilters(notification, view, employeeSearch, filterDate),
    );
  }, [employeeSearch, filterDate, notifications, view]);

  const hasActiveFilters = employeeSearch.trim().length > 0 || filterDate.length > 0;
  const visibleViews = VIEW_OPTIONS.filter((option) => !option.adminOnly || canViewAll);
  const showRecipient = view === "all" || (view === "messages" && canViewAll);

  const viewDescription =
    view === "all"
      ? "Activity alerts across all workspace users."
      : view === "messages"
        ? canViewAll
          ? "Direct messages received across the workspace."
          : "Messages sent to you by teammates."
        : "Your personal alerts from projects, tasks, and daily updates.";

  const resetFilters = () => {
    setEmployeeSearch("");
    setFilterDate("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle as="h2">Notifications</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">{viewDescription}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <div className="relative min-w-[200px] flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="Search notifications…"
              className="h-9 rounded-xl pl-9"
            />
          </div>
          <Input
            type="date"
            value={filterDate}
            onChange={(event) => setFilterDate(event.target.value)}
            className="h-9 w-[11.5rem] rounded-xl"
            max={todayIso()}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            disabled={!hasActiveFilters}
            onClick={resetFilters}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <div className="inline-flex rounded-xl border border-border/70 bg-background/80 p-1">
            {visibleViews.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={view === option.id ? "default" : "ghost"}
                className="h-8 rounded-lg px-3 text-xs"
                onClick={() => setView(option.id)}
              >
                {option.id === "messages" ? (
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                ) : null}
                {option.label}
              </Button>
            ))}
          </div>
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
          ) : filteredNotifications.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              {view === "messages" ? (
                <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
              ) : (
                <Bell className="h-8 w-8 text-muted-foreground/50" />
              )}
              <p className="text-sm font-medium text-foreground">
                {hasActiveFilters
                  ? `No ${view === "messages" ? "messages" : "notifications"} match your filters`
                  : view === "messages"
                    ? "No messages yet"
                    : "No notifications yet"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Try another name, keyword, or date, or clear filters."
                  : view === "messages"
                    ? "New chat messages from teammates will appear here."
                    : "Project assignments, task updates, and daily update alerts will appear here."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredNotifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  showRecipient={showRecipient}
                  onNavigate={(item) => void markRead(item)}
                  className="rounded-none hover:bg-muted/40"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && !error && hasActiveFilters && filteredNotifications.length > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          Showing {filteredNotifications.length}{" "}
          {view === "messages" ? "message" : "notification"}
          {filteredNotifications.length === 1 ? "" : "s"} matching your filters.
        </p>
      ) : null}

      {!loading && !error && view === "messages" && !hasActiveFilters && filteredNotifications.length > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          Showing {filteredNotifications.length} message
          {filteredNotifications.length === 1 ? "" : "s"}
          {canViewAll ? " across the workspace" : ""}.
        </p>
      ) : null}

      {!loading && !error && view !== "messages" && !hasActiveFilters && totalCount > notifications.length ? (
        <p className="text-center text-xs text-muted-foreground">
          Showing latest {notifications.length} of {totalCount} notifications.
        </p>
      ) : null}
    </div>
  );
}
