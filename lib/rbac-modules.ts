import type { Permission } from "@/lib/permissions";

export const RBAC_MODULES = [
  "dashboard",
  "projects",
  "teamMembers",
  "seating",
  "gallery",
  "roles",
  "appUsers",
  "chat",
] as const;

export type RbacModule = (typeof RBAC_MODULES)[number];

export type ModuleActionConfig = {
  key: string;
  label: string;
  description: string;
  permission: Permission;
};

export type ModulePermission = {
  view: boolean;
  manage: boolean;
  actions: Record<string, boolean>;
};

export type ModulePermissionsMap = Record<RbacModule, ModulePermission>;

type ModulePermissionInput = Partial<{
  view: boolean;
  manage: boolean;
  actions: Record<string, boolean>;
}>;

type ModuleCatalogEntry = {
  title: string;
  description: string;
  view: string;
  manage: string;
  viewPermission: Permission;
  managePermission: Permission;
  actions: readonly ModuleActionConfig[];
};

export const MODULE_PERMISSION_CATALOG: Record<RbacModule, ModuleCatalogEntry> = {
  dashboard: {
    title: "Dashboard",
    description: "Workspace home, analytics widgets, and exportable summaries.",
    view: "View Dashboard",
    manage: "Manage Dashboard",
    viewPermission: "dashboard:view",
    managePermission: "dashboard:manage",
    actions: [
      {
        key: "analytics",
        label: "Analytics",
        description: "Open analytics widgets, occupancy insights, and KPI views.",
        permission: "dashboard:analytics",
      },
      {
        key: "export",
        label: "Export",
        description: "Export dashboard snapshots and downloadable summaries.",
        permission: "dashboard:export",
      },
    ],
  },
  projects: {
    title: "Team Projects",
    description: "Project records, assignments, delivery updates, and status workflows.",
    view: "View Projects",
    manage: "Manage Projects",
    viewPermission: "projects:view",
    managePermission: "projects:manage",
    actions: [
      {
        key: "create",
        label: "Create",
        description: "Create new project entries and draft plans.",
        permission: "projects:create",
      },
      {
        key: "edit",
        label: "Edit",
        description: "Update project details, owners, and dates.",
        permission: "projects:edit",
      },
      {
        key: "delete",
        label: "Delete",
        description: "Remove projects from the workspace.",
        permission: "projects:delete",
      },
      {
        key: "assign",
        label: "Assign",
        description: "Assign employees and squads to project work.",
        permission: "projects:assign",
      },
      {
        key: "changeStatus",
        label: "Change Status",
        description: "Move projects across delivery states.",
        permission: "projects:change_status",
      },
    ],
  },
  teamMembers: {
    title: "Team Members",
    description: "Employee directory, profiles, project assignment, and exports.",
    view: "View Team Members",
    manage: "Manage Team Members",
    viewPermission: "teamMembers:view",
    managePermission: "teamMembers:manage",
    actions: [
      {
        key: "create",
        label: "Create",
        description: "Add new team member records.",
        permission: "teamMembers:create",
      },
      {
        key: "edit",
        label: "Edit",
        description: "Edit employee details and directory data.",
        permission: "teamMembers:edit",
      },
      {
        key: "delete",
        label: "Delete",
        description: "Remove employee records.",
        permission: "teamMembers:delete",
      },
      {
        key: "assignProjects",
        label: "Assign Projects",
        description: "Assign project work to employees.",
        permission: "teamMembers:assign_projects",
      },
      {
        key: "export",
        label: "Export",
        description: "Export employee directory data.",
        permission: "teamMembers:export",
      },
    ],
  },
  seating: {
    title: "Seating Arrangement",
    description: "Seat visibility, assignment, and floor layout administration.",
    view: "View Seating",
    manage: "Manage Seating",
    viewPermission: "seating:view",
    managePermission: "seating:manage",
    actions: [
      {
        key: "assignSeats",
        label: "Assign Seats",
        description: "Assign or reassign seating to employees.",
        permission: "seating:assign_seats",
      },
      {
        key: "editLayout",
        label: "Edit Layout",
        description: "Change floor layout metadata and planning controls.",
        permission: "seating:edit_layout",
      },
    ],
  },
  gallery: {
    title: "Gallery",
    description: "Company gallery uploads, edits, curation, and cleanup.",
    view: "View Gallery",
    manage: "Manage Gallery",
    viewPermission: "gallery:view",
    managePermission: "gallery:manage",
    actions: [
      {
        key: "upload",
        label: "Upload",
        description: "Create and publish new gallery items.",
        permission: "gallery:upload",
      },
      {
        key: "edit",
        label: "Edit",
        description: "Edit existing gallery titles, metadata, or images.",
        permission: "gallery:edit",
      },
      {
        key: "delete",
        label: "Delete",
        description: "Delete gallery content from the workspace.",
        permission: "gallery:delete",
      },
    ],
  },
  roles: {
    title: "Roles & Access",
    description: "Role creation, editing, deletion, and permission governance.",
    view: "View Roles",
    manage: "Manage Roles",
    viewPermission: "roles:view",
    managePermission: "roles:manage",
    actions: [
      {
        key: "createRoles",
        label: "Create Roles",
        description: "Create new workspace roles.",
        permission: "roles:create",
      },
      {
        key: "editRoles",
        label: "Edit Roles",
        description: "Edit role names, descriptions, and metadata.",
        permission: "roles:edit",
      },
      {
        key: "deleteRoles",
        label: "Delete Roles",
        description: "Delete custom roles from the workspace.",
        permission: "roles:delete",
      },
      {
        key: "managePermissions",
        label: "Manage Permissions",
        description: "Change permission matrices and access policies.",
        permission: "roles:manage_permissions",
      },
    ],
  },
  chat: {
    title: "Messages",
    description: "One-to-one messaging between employees and workspace admin.",
    view: "View Messages",
    manage: "Admin inbox",
    viewPermission: "chat:view",
    managePermission: "chat:manage",
    actions: [
      {
        key: "send",
        label: "Send",
        description: "Send messages in allowed conversations.",
        permission: "chat:send",
      },
    ],
  },
  appUsers: {
    title: "App Users",
    description: "Workspace accounts, invitations, edits, and account lifecycle controls.",
    view: "View App Users",
    manage: "Manage App Users",
    viewPermission: "appUsers:view",
    managePermission: "appUsers:manage",
    actions: [
      {
        key: "create",
        label: "Create",
        description: "Create app user accounts.",
        permission: "appUsers:create",
      },
      {
        key: "edit",
        label: "Edit",
        description: "Edit app user profile and role assignments.",
        permission: "appUsers:edit",
      },
      {
        key: "delete",
        label: "Delete",
        description: "Delete app users and linked workspace records.",
        permission: "appUsers:delete",
      },
      {
        key: "invite",
        label: "Invite",
        description: "Send account invitation or welcome emails.",
        permission: "appUsers:invite",
      },
      {
        key: "suspend",
        label: "Suspend",
        description: "Suspend access or disable accounts in the future.",
        permission: "appUsers:suspend",
      },
    ],
  },
};

export const MODULE_LABELS: Record<
  RbacModule,
  { title: string; view: string; manage: string }
> = RBAC_MODULES.reduce(
  (acc, mod) => {
    const entry = MODULE_PERMISSION_CATALOG[mod];
    acc[mod] = {
      title: entry.title,
      view: entry.view,
      manage: entry.manage,
    };
    return acc;
  },
  {} as Record<RbacModule, { title: string; view: string; manage: string }>,
);

export const NAV_PATH_MODULES: Record<string, RbacModule> = {
  "/dashboard": "dashboard",
  "/projects": "projects",
  "/team-members": "teamMembers",
  "/seating": "seating",
  "/gallery": "gallery",
  "/roles": "roles",
  "/app-users": "appUsers",
  "/chat": "chat",
};

export function getModuleActionConfigs(module: RbacModule): readonly ModuleActionConfig[] {
  return MODULE_PERMISSION_CATALOG[module].actions;
}

export function emptyModulePermission(module: RbacModule): ModulePermission {
  return {
    view: false,
    manage: false,
    actions: Object.fromEntries(
      getModuleActionConfigs(module).map((action) => [action.key, false]),
    ),
  };
}

export function emptyModulePermissions(): ModulePermissionsMap {
  return RBAC_MODULES.reduce(
    (acc, mod) => {
      acc[mod] = emptyModulePermission(mod);
      return acc;
    },
    {} as ModulePermissionsMap,
  );
}

function normalizeModulePermission(
  module: RbacModule,
  input: ModulePermissionInput | undefined,
): ModulePermission {
  const base = emptyModulePermission(module);
  if (!input) {
    return base;
  }

  const manage = !!input.manage;
  const nextActions: Record<string, boolean> = { ...base.actions };

  for (const action of getModuleActionConfigs(module)) {
    nextActions[action.key] = manage || !!input.actions?.[action.key];
  }

  const hasAdvancedActions = Object.values(nextActions).some(Boolean);
  const view = manage || !!input.view || hasAdvancedActions;

  return {
    view,
    manage,
    actions: nextActions,
  };
}

/** Manage implies view and all related actions. Any advanced action implies view. */
export function normalizeModulePermissions(
  input: Partial<Record<RbacModule, ModulePermissionInput>> | undefined,
): ModulePermissionsMap {
  const base = emptyModulePermissions();
  if (!input) {
    return base;
  }

  for (const mod of RBAC_MODULES) {
    base[mod] = normalizeModulePermission(mod, input[mod]);
  }

  return base;
}

export function hasModulePermissionAction(
  module: RbacModule,
  permission: ModulePermission | undefined,
  actionKey: string,
): boolean {
  if (!permission) {
    return false;
  }
  return !!permission.manage || !!permission.actions[actionKey];
}

export function moduleHasAnyAccess(permission: ModulePermission | undefined): boolean {
  if (!permission) {
    return false;
  }
  return permission.view || permission.manage || Object.values(permission.actions).some(Boolean);
}

export function getEnabledModuleActionLabels(
  module: RbacModule,
  permission: ModulePermission | undefined,
): string[] {
  if (!permission || !moduleHasAnyAccess(permission)) {
    return [];
  }

  const labels: string[] = [];
  if (permission.view) {
    labels.push("View");
  }
  for (const action of getModuleActionConfigs(module)) {
    if (hasModulePermissionAction(module, permission, action.key)) {
      labels.push(action.label);
    }
  }
  if (permission.manage) {
    labels.push("Manage");
  }
  return [...new Set(labels)];
}

export type RoleAccessFlags = {
  permissions: Permission[];
  teamScopedProjects: boolean;
  teamScopedSeating: boolean;
};

/** Map module permissions to both granular and legacy permission strings used across the app. */
export function resolveLegacyAccess(
  modules: ModulePermissionsMap,
  options?: { teamScopedProjects?: boolean; teamScopedSeating?: boolean },
): RoleAccessFlags {
  const permissions = new Set<Permission>();
  const teamScopedProjects = options?.teamScopedProjects ?? false;
  const teamScopedSeating = options?.teamScopedSeating ?? false;

  for (const rbacModule of RBAC_MODULES) {
    const row = modules[rbacModule];
    const entry = MODULE_PERMISSION_CATALOG[rbacModule];
    if (!moduleHasAnyAccess(row)) {
      continue;
    }

    permissions.add(entry.viewPermission);
    if (row.manage) {
      permissions.add(entry.managePermission);
    }

    for (const action of entry.actions) {
      if (hasModulePermissionAction(rbacModule, row, action.key)) {
        permissions.add(action.permission);
      }
    }
  }

  if (modules.teamMembers.view) {
    permissions.add("employees:read");
  }
  if (
    modules.teamMembers.manage ||
    hasModulePermissionAction("teamMembers", modules.teamMembers, "create") ||
    hasModulePermissionAction("teamMembers", modules.teamMembers, "edit") ||
    hasModulePermissionAction("teamMembers", modules.teamMembers, "delete") ||
    hasModulePermissionAction("teamMembers", modules.teamMembers, "assignProjects")
  ) {
    permissions.add("employees:read");
    permissions.add("employees:read_all");
    permissions.add("employees:write");
  }

  if (modules.projects.view) {
    permissions.add("projects:read");
  }
  const hasProjectWriteAccess =
    modules.projects.manage ||
    hasModulePermissionAction("projects", modules.projects, "create") ||
    hasModulePermissionAction("projects", modules.projects, "edit") ||
    hasModulePermissionAction("projects", modules.projects, "delete") ||
    hasModulePermissionAction("projects", modules.projects, "assign") ||
    hasModulePermissionAction("projects", modules.projects, "changeStatus");

  if (hasProjectWriteAccess) {
    permissions.add("projects:read");
    if (teamScopedProjects) {
      permissions.add("projects:manage_team");
    } else {
      permissions.add("projects:read_all");
      permissions.add("projects:manage");
    }
  }

  if (modules.gallery.view) {
    permissions.add("gallery:read");
  }
  if (
    modules.gallery.manage ||
    hasModulePermissionAction("gallery", modules.gallery, "upload") ||
    hasModulePermissionAction("gallery", modules.gallery, "edit") ||
    hasModulePermissionAction("gallery", modules.gallery, "delete")
  ) {
    permissions.add("gallery:read");
    permissions.add("gallery:write");
  }

  if (modules.seating.view) {
    permissions.add("seating:read");
  }
  if (
    modules.seating.manage ||
    hasModulePermissionAction("seating", modules.seating, "assignSeats") ||
    hasModulePermissionAction("seating", modules.seating, "editLayout")
  ) {
    permissions.add("seating:read");
    if (teamScopedSeating) {
      permissions.add("seating:assign_team");
    } else {
      permissions.add("seating:assign");
    }
  }

  if (modules.roles.view) {
    permissions.add("roles:read");
  }
  if (
    modules.roles.manage ||
    hasModulePermissionAction("roles", modules.roles, "createRoles") ||
    hasModulePermissionAction("roles", modules.roles, "editRoles") ||
    hasModulePermissionAction("roles", modules.roles, "deleteRoles") ||
    hasModulePermissionAction("roles", modules.roles, "managePermissions")
  ) {
    permissions.add("roles:read");
    permissions.add("roles:manage");
  }

  if (modules.chat.view) {
    permissions.add("chat:view");
  }
  if (
    modules.chat.manage ||
    hasModulePermissionAction("chat", modules.chat, "send")
  ) {
    permissions.add("chat:view");
    permissions.add("chat:send");
  }
  if (modules.chat.manage) {
    permissions.add("chat:manage");
  }

  if (modules.appUsers.view) {
    permissions.add("appUsers:read");
  }
  if (
    modules.appUsers.manage ||
    hasModulePermissionAction("appUsers", modules.appUsers, "create") ||
    hasModulePermissionAction("appUsers", modules.appUsers, "edit") ||
    hasModulePermissionAction("appUsers", modules.appUsers, "delete") ||
    hasModulePermissionAction("appUsers", modules.appUsers, "invite") ||
    hasModulePermissionAction("appUsers", modules.appUsers, "suspend")
  ) {
    permissions.add("appUsers:read");
    permissions.add("appUsers:manage");
  }

  return {
    permissions: [...permissions],
    teamScopedProjects,
    teamScopedSeating,
  };
}
