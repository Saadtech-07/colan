export const WORKSPACE_SLICES = [
  "roles",
  "employees",
  "projects",
  "gallery",
  "teams",
  "dbStatus",
] as const;

export type WorkspaceSlice = (typeof WORKSPACE_SLICES)[number];
