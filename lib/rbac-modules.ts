import type { Permission } from "@/lib/permissions";

export const RBAC_MODULES = [
  "dashboard",
  "projects",
  "teamMembers",
  "seating",
  "gallery",
  "roles",
  "appUsers",
] as const;

export type RbacModule = (typeof RBAC_MODULES)[number];

export type ModulePermission = {
  view: boolean;
  manage: boolean;
};

export type ModulePermissionsMap = Record<RbacModule, ModulePermission>;

export const MODULE_LABELS: Record<
  RbacModule,
  { title: string; view: string; manage: string }
> = {
  dashboard: {
    title: "Dashboard",
    view: "View Dashboard",
    manage: "Manage Dashboard",
  },
  projects: {
    title: "Team Projects",
    view: "View Projects",
    manage: "Manage Projects",
  },
  teamMembers: {
    title: "Team Members",
    view: "View Team Members",
    manage: "Manage Team Members",
  },
  seating: {
    title: "Seating Arrangement",
    view: "View Seating",
    manage: "Manage Seating",
  },
  gallery: {
    title: "Gallery",
    view: "View Gallery",
    manage: "Manage Gallery",
  },
  roles: {
    title: "Roles & Access",
    view: "View Roles",
    manage: "Manage Roles",
  },
  appUsers: {
    title: "App Users",
    view: "View App Users",
    manage: "Manage App Users",
  },
};

export const NAV_PATH_MODULES: Record<string, RbacModule> = {
  "/dashboard": "dashboard",
  "/projects": "projects",
  "/team-members": "teamMembers",
  "/seating": "seating",
  "/gallery": "gallery",
  "/roles": "roles",
  "/app-users": "appUsers",
};

export function emptyModulePermissions(): ModulePermissionsMap {
  return RBAC_MODULES.reduce(
    (acc, mod) => {
      acc[mod] = { view: false, manage: false };
      return acc;
    },
    {} as ModulePermissionsMap,
  );
}

/** Manage implies view. */
export function normalizeModulePermissions(
  input: Partial<ModulePermissionsMap> | undefined,
): ModulePermissionsMap {
  const base = emptyModulePermissions();
  if (!input) return base;

  for (const mod of RBAC_MODULES) {
    const row = input[mod];
    if (!row) continue;
    const manage = !!row.manage;
    base[mod] = {
      view: manage || !!row.view,
      manage,
    };
  }
  return base;
}

export type RoleAccessFlags = {
  permissions: Permission[];
  teamScopedProjects: boolean;
  teamScopedSeating: boolean;
};

/** Map view/manage modules to legacy permission strings used across the app. */
export function resolveLegacyAccess(
  modules: ModulePermissionsMap,
  options?: { teamScopedProjects?: boolean; teamScopedSeating?: boolean },
): RoleAccessFlags {
  const permissions = new Set<Permission>();
  const teamScopedProjects = options?.teamScopedProjects ?? false;
  const teamScopedSeating = options?.teamScopedSeating ?? false;

  if (modules.teamMembers.view) {
    permissions.add("employees:read");
    if (!modules.teamMembers.manage) {
      /* read scoped to team when not manage-all */
    }
  }
  if (modules.teamMembers.manage) {
    permissions.add("employees:read");
    permissions.add("employees:read_all");
    permissions.add("employees:write");
  }

  if (modules.projects.view) {
    permissions.add("projects:read");
  }
  if (modules.projects.manage) {
    permissions.add("projects:read");
    if (teamScopedProjects) {
      permissions.add("projects:manage_team");
    } else {
      permissions.add("projects:read_all");
      permissions.add("projects:manage");
    }
  } else if (modules.projects.view && teamScopedProjects) {
    /* squad read */
  }

  if (modules.gallery.view) permissions.add("gallery:read");
  if (modules.gallery.manage) {
    permissions.add("gallery:read");
    permissions.add("gallery:write");
  }

  if (modules.seating.view) permissions.add("seating:read");
  if (modules.seating.manage) {
    permissions.add("seating:read");
    if (teamScopedSeating) {
      permissions.add("seating:assign_team");
    } else {
      permissions.add("seating:assign");
    }
  }

  if (modules.roles.view) permissions.add("roles:read");
  if (modules.roles.manage) {
    permissions.add("roles:read");
    permissions.add("roles:manage");
  }

  if (modules.appUsers.view) permissions.add("appUsers:read");
  if (modules.appUsers.manage) {
    permissions.add("appUsers:read");
    permissions.add("appUsers:manage");
  }

  if (modules.dashboard.view || modules.dashboard.manage) {
    /* dashboard nav allowed */
  }

  return {
    permissions: [...permissions],
    teamScopedProjects,
    teamScopedSeating,
  };
}
