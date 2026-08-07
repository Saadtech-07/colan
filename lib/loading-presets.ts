export type LoadingPreset = {
  title: string;
  description: string;
};

export const LOADING_PRESETS = {
  session: {
    title: "Loading workspace",
    description: "Preparing your dashboard session...",
  },
  syncWorkspace: {
    title: "Syncing workspace",
    description: "Updating employees, projects, and workspace data...",
  },
  loadingAccounts: {
    title: "Loading accounts",
    description: "Fetching application user accounts...",
  },
  creatingAccount: {
    title: "Creating account",
    description: "Creating the new workspace account...",
  },
  updatingAccount: {
    title: "Saving changes",
    description: "Saving account updates...",
  },
  removingAccount: {
    title: "Removing account",
    description: "Removing the workspace account...",
  },
  loadingRoles: {
    title: "Loading roles",
    description: "Fetching workspace roles and permissions...",
  },
  savingRole: {
    title: "Saving role",
    description: "Updating role permissions...",
  },
  creatingEmployee: {
    title: "Adding team member",
    description: "Creating the new employee profile...",
  },
  updatingEmployee: {
    title: "Saving changes",
    description: "Saving employee details...",
  },
  removingEmployee: {
    title: "Removing team member",
    description: "Removing the employee record...",
  },
  assigningBay: {
    title: "Updating seating",
    description: "Updating seat assignment...",
  },
  seatingAiGenerate: {
    title: "Generating seating layout",
    description: "Building seat suggestions...",
  },
  seatingAiApply: {
    title: "Applying seating",
    description: "Updating seat assignments...",
  },
  seatingLayoutEdit: {
    title: "Updating Colan layout",
    description: "Applying layout changes to the floor plan...",
  },
  creatingFloorPlan: {
    title: "Creating floor plan",
    description: "Saving the new office floor plan...",
  },
  updatingFloorPlan: {
    title: "Saving floor plan",
    description: "Updating seating rows and cabins...",
  },
  deletingFloorPlan: {
    title: "Deleting floor plan",
    description: "Removing the office floor plan from the database...",
  },
  loadingProjects: {
    title: "Loading projects",
    description: "Fetching project portfolio...",
  },
  loadingProject: {
    title: "Loading project",
    description: "Loading project details...",
  },
  creatingProject: {
    title: "Creating project",
    description: "Adding the new project...",
  },
  updatingProjectMembership: {
    title: "Saving changes",
    description: "Updating project assignments...",
  },
} as const satisfies Record<string, LoadingPreset>;

export const LOADING_KEY_PRIORITY = [
  "app-users-submit",
  "app-users-delete",
  "app-users-fetch",
  "role-delete",
  "role-save",
  "employee-save",
  "employee-delete",
  "employee-create",
  "employee-projects",
  "project-create",
  "seating-assign",
  "seating-ai-generate",
  "seating-layout-edit",
  "seating-ai-apply",
  "floor-plan-create",
  "floor-plan-update",
  "floor-plan-delete",
  "project-detail",
  "workspace-sync",
  "session",
] as const;
