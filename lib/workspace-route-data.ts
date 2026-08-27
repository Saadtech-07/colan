import type { WorkspaceSlice } from "@/lib/workspace-slices";

/**
 * Which workspace data slices a dashboard route needs.
 * `roles` is always required for RBAC / sidebar.
 */
export function workspaceSlicesForPath(pathname: string): WorkspaceSlice[] {
  const p = (pathname.replace(/\/$/, "") || "/").toLowerCase();

  if (p === "/gallery") return ["roles", "gallery"];
  // Create/edit floor only needs RBAC. Occupancy comes from employees on /seating.
  if (p.startsWith("/seating/floors")) return ["roles"];
  if (p.startsWith("/seating")) return ["roles", "employees"];
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
    // dbStatus loads in the background after core slices (non-blocking).
    return ["roles", "employees", "projects", "teams"];
  }
  if (p.startsWith("/projects")) {
    return ["roles", "employees", "projects", "teams"];
  }

  // Unknown dashboard routes: load core directory data only (no gallery).
  return ["roles", "employees", "projects", "teams"];
}

export function pathsThatWantBackgroundDbStatus(pathname: string): boolean {
  const p = (pathname.replace(/\/$/, "") || "/").toLowerCase();
  return p === "/dashboard" || p.startsWith("/projects");
}

export function isChatRoute(pathname: string): boolean {
  const p = (pathname.replace(/\/$/, "") || "/").toLowerCase();
  return p === "/chat" || p.startsWith("/chat/");
}

export function isSeatingRoute(pathname: string): boolean {
  const p = (pathname.replace(/\/$/, "") || "/").toLowerCase();
  return p === "/seating" || p.startsWith("/seating/");
}
