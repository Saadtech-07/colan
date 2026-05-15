"use client";

import * as React from "react";
import { Bell, Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppState } from "@/providers/app-state";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

function statusBadge(status: ProjectStatus) {
  if (status === "Completed") return "success" as const;
  if (status === "In Progress") return "default" as const;
  return "warning" as const;
}

function statusColor(status: ProjectStatus) {
  if (status === "Completed") return "text-emerald-600";
  if (status === "In Progress") return "text-blue-600";
  return "text-amber-600";
}

export function NotificationDropdown() {
  const {
    notifications,
    markNotificationAsRead,
    getUnreadCount,
    isAdmin,
    user,
  } = useAppState();
  const [open, setOpen] = React.useState(false);

  const visibleNotifications = React.useMemo(() => {
    // Admin should not see project assignment notifications they created
    // Only team members see notifications for their team
    if (isAdmin) return [];
    return notifications.filter((n) => n.team === user?.team);
  }, [notifications, isAdmin, user?.team]);

  const unreadCount = getUnreadCount();

  const handleMarkAsRead = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await markNotificationAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    for (const notification of visibleNotifications) {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.id);
      }
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground transition-all duration-200"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="absolute -right-1 -top-1 h-5 min-w-5 animate-pulse p-0 text-xs flex items-center justify-center bg-primary"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0 shadow-lg border-border/80"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-80">
          {visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No notifications available
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                You'll see project assignments here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {visibleNotifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "flex flex-col items-start gap-2 p-4 cursor-pointer transition-colors hover:bg-muted/50",
                    !notification.isRead && "bg-muted/30"
                  )}
                  onSelect={() => setOpen(false)}
                >
                  <div className="flex items-start justify-between w-full gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{notification.projectName}</p>
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{notification.assignedDate}</span>
                        <span>•</span>
                        <span className={statusColor(notification.status)}>
                          {notification.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs w-fit">
                          {notification.team}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          by {notification.assignedBy}
                        </span>
                      </div>
                    </div>
                    {!notification.isRead && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => handleMarkAsRead(e, notification.id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
