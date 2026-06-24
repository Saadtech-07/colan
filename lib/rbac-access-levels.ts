import {
  getModuleActionConfigs,
  type ModulePermission,
  type ModulePermissionsMap,
  type RbacModule,
} from "@/lib/rbac-modules";
import type { PermissionAccessLevel } from "@/types";

export const ACCESS_LEVEL_OPTIONS: Array<{ value: PermissionAccessLevel; label: string }> = [
  { value: "none", label: "No Access" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
  { value: "full", label: "Full Access" },
];

export function modulePermissionToAccessLevel(
  module: RbacModule,
  permission: ModulePermission | undefined,
): PermissionAccessLevel {
  if (!permission) return "none";
  if (permission.manage) return "full";
  const actions = getModuleActionConfigs(module);
  const enabledActions = actions.filter((action) => permission.actions[action.key]);
  if (enabledActions.length > 0) return "edit";
  if (permission.view) return "view";
  return "none";
}

export function accessLevelToModulePermission(
  module: RbacModule,
  level: PermissionAccessLevel,
  current?: ModulePermission,
): ModulePermission {
  const actions = getModuleActionConfigs(module);
  const baseActions = Object.fromEntries(actions.map((action) => [action.key, false]));

  if (level === "none") {
    return { view: false, manage: false, actions: baseActions };
  }

  if (level === "view") {
    return { view: true, manage: false, actions: baseActions };
  }

  if (level === "edit") {
    return {
      view: true,
      manage: false,
      actions: Object.fromEntries(actions.map((action) => [action.key, true])),
    };
  }

  return {
    view: true,
    manage: true,
    actions: Object.fromEntries(actions.map((action) => [action.key, true])),
  };
}

export function setModuleAccessLevel(
  permissions: ModulePermissionsMap,
  module: RbacModule,
  level: PermissionAccessLevel,
): ModulePermissionsMap {
  return {
    ...permissions,
    [module]: accessLevelToModulePermission(module, level, permissions[module]),
  };
}
