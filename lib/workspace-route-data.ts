import type { WorkspaceSlice } from "@/lib/workspace-slices";

/**
 * Which workspace data slices a dashboard route needs.
 * `roles` is always required for RBAC / sidebar.
 */
export function workspaceSlicesForPath(pathname: string): WorkspaceSlice[] {
  const p = (pathname.replace(/\/$/, "") || "/").toLowerCase();

  if (p === "/gallery") return ["roles", "gallery"];
  if (p.startsWith("/seating")) return ["roles", "employees", "teams"];
  if (p === "/roles" || p.startsWith("/organization/roles")) return ["roles"];
  if (p.startsWith("/chat") || p.startsWith("/notifications")) return ["roles"];
  if (p.startsWith("/profile-settings")) return ["roles"];
  if (p.startsWith("/app-users")) return ["roles", "employees", "teams"];
  if (
    p === "/team-members" ||
    p.startsWith("/team-members/") ||
    p.startsWith("/organization/team-members")
  ) {
    return ["roles", "employees", "projects", "teams"];
  }
  if (p === "/dashboard") {
    return ["roles", "employees", "projects", "teams", "dbStatus"];
  }
  if (p.startsWith("/projects")) {
    return ["roles", "employees", "projects", "teams", "dbStatus"];
  }

  // Unknown dashboard routes: load core directory data only (no gallery).
  return ["roles", "employees", "projects", "teams"];
}

export function isChatRoute(pathname: string): boolean {
  const p = (pathname.replace(/\/$/, "") || "/").toLowerCase();
  return p === "/chat" || p.startsWith("/chat/");
}
