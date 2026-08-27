"use client";

import Link from "next/link";
import {
  Briefcase,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { formatChatTime } from "@/lib/chat-client";
import { notificationHref, notificationTypeLabel } from "@/lib/notification-routing";
import { cn } from "@/lib/utils";
import type { NotificationDTO, NotificationType } from "@/models";

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  project_assigned: Briefcase,
  task_assigned: CheckSquare,
  task_status_changed: ClipboardList,
  task_completed: CheckSquare,
  daily_update_submitted: CalendarClock,
  message_received: MessageCircle,
};

type Props = {
  notification: NotificationDTO;
  showRecipient?: boolean;
  onNavigate?: (notification: NotificationDTO) => void;
  className?: string;
  variant?: "full" | "compact";
};

function formatNotificationStamp(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return {
    date: sameDay
      ? "Today"
      : date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        }),
    time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

export function NotificationListItem({
  notification,
  showRecipient = false,
  onNavigate,
  className,
  variant = "full",
}: Props) {
  const href = notificationHref(notification);
  const Icon = TYPE_ICONS[notification.type] ?? Briefcase;
  const typeLabel = notificationTypeLabel(notification.type);

  if (variant === "compact") {
    const compactContent = (
      <>
        <div
          className={cn(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            notification.readAt ? "bg-muted/80 text-muted-foreground" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4 border-b border-border/35 pb-2">
            <p className="font-heading text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-muted-foreground">
              {typeLabel}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[11px] font-normal tabular-nums leading-none text-muted-foreground">
                {formatChatTime(notification.createdAt)}
              </span>
              {!notification.readAt ? (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              ) : null}
            </div>
          </div>
          <div className="space-y-1 pt-2.5">
            <p className="truncate text-[15px] font-semibold leading-snug text-foreground">
              {notification.actorName ?? (
                <span className="font-normal text-muted-foreground">Unknown sender</span>
              )}
            </p>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
              {notification.message}
            </p>
          </div>
        </div>
      </>
    );

    const compactClassName = cn(
      "flex w-full items-start gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/35",
      !notification.readAt && "bg-primary/[0.03]",
      className,
    );

    if (!href) {
      return (
        <button
          type="button"
          className={compactClassName}
          onClick={() => onNavigate?.(notification)}
        >
          {compactContent}
        </button>
      );
    }

    return (
      <Link
        href={href}
        className={compactClassName}
        onClick={() => onNavigate?.(notification)}
      >
        {compactContent}
      </Link>
    );
  }

  const stamp = formatNotificationStamp(notification.createdAt);

  const content = (
    <>
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          notification.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="space-y-1">
          <p className="text-sm font-medium leading-snug text-foreground">{notification.title}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
            {typeLabel}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{notification.message}</p>
        {notification.actorName || (showRecipient && notification.recipientName) ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/80">
            {notification.actorName ? <span>{notification.actorName}</span> : null}
            {showRecipient && notification.recipientName ? (
              <span>· For {notification.recipientName}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 pl-3 sm:min-w-[4.5rem] sm:pl-4">
        {stamp.date || stamp.time ? (
          <div className="text-right leading-tight">
            {stamp.date ? (
              <p className="whitespace-nowrap text-[11px] font-medium tabular-nums text-muted-foreground">
                {stamp.date}
              </p>
            ) : null}
            {stamp.time ? (
              <p className="mt-0.5 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground/75">
                {stamp.time}
              </p>
            ) : null}
          </div>
        ) : null}
        {!notification.readAt ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
        ) : null}
      </div>
    </>
  );

  if (!href) {
    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50 sm:px-5",
          !notification.readAt && "bg-primary/5",
          className,
        )}
        onClick={() => onNavigate?.(notification)}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5",
        !notification.readAt && "bg-primary/5",
        className,
      )}
      onClick={() => onNavigate?.(notification)}
    >
      {content}
    </Link>
  );
}
