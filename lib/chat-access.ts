import {
  canAccessModuleAction,
  canManageModule,
  canViewModule,
  hasPermission,
  normalizeAppRole,
} from "@/lib/permissions";
import type { AppRole } from "@/types";

export const WORKSPACE_CHAT_ADMIN_ROLE = "admin";

export function isWorkspaceChatAdmin(appRole: AppRole): boolean {
  return normalizeAppRole(appRole) === WORKSPACE_CHAT_ADMIN_ROLE;
}

export function canAccessChat(roleKey: AppRole): boolean {
  if (isWorkspaceChatAdmin(roleKey)) return true;
  return canViewModule(roleKey, "chat") || hasPermission(roleKey, "chat:view");
}

export function canSendChat(roleKey: AppRole): boolean {
  if (isWorkspaceChatAdmin(roleKey)) return true;
  return (
    canAccessModuleAction(roleKey, "chat", "send") ||
    canManageModule(roleKey, "chat") ||
    hasPermission(roleKey, "chat:send")
  );
}
