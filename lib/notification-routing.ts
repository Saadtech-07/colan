import type { NotificationDTO, NotificationType } from "@/models";

export function notificationHref(notification: NotificationDTO): string | null {
  if (notification.taskId) {
    return `/projects/tasks?task=${notification.taskId}`;
  }
  if (notification.type === "daily_update_submitted") {
    return "/projects/daily-updates";
  }
  if (notification.projectSlug) {
    return `/projects/${notification.projectSlug}`;
  }
  return null;
}

export function notificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case "project_assigned":
      return "Project";
    case "task_assigned":
      return "Task assigned";
    case "task_status_changed":
      return "Task updated";
    case "task_completed":
      return "Task completed";
    case "daily_update_submitted":
      return "Daily update";
    default:
      return "Notification";
  }
}
