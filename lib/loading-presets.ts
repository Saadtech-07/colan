export type LoadingPreset = {
  title: string;
  description: string;
};

export const LOADING_PRESETS = {
  session: {
    title: "Loading Workspace",
    description: "Preparing your admin dashboard session...",
  },
  syncWorkspace: {
    title: "Syncing Workspace",
    description:
      "Updating employees, projects, seating and workspace data...",
  },
  loadingAccounts: {
    title: "Loading Accounts",
    description: "Fetching application user accounts from the workspace...",
  },
  creatingAccount: {
    title: "Creating Account",
    description: "Please wait while the employee account is being created...",
  },
  updatingAccount: {
    title: "Updating Account",
    description: "Please wait while the account changes are being saved...",
  },
  removingAccount: {
    title: "Removing Account",
    description: "Please wait while the employee account is being removed...",
  },
  creatingEmployee: {
    title: "Adding Team Member",
    description: "Please wait while the new employee profile is being created...",
  },
  updatingEmployee: {
    title: "Updating Team Member",
    description: "Please wait while employee details are being saved...",
  },
  removingEmployee: {
    title: "Removing Team Member",
    description: "Please wait while the employee record is being removed...",
  },
  assigningBay: {
    title: "Updating Seating",
    description: "Please wait while the bay assignment is being updated...",
  },
  loadingProjects: {
    title: "Loading Projects",
    description: "Fetching project portfolio data from the workspace...",
  },
  loadingProject: {
    title: "Loading Project",
    description: "Please wait while project details are being loaded...",
  },
  creatingProject: {
    title: "Creating Project",
    description: "Please wait while the new project is being added...",
  },
  updatingProjectMembership: {
    title: "Updating Projects",
    description: "Please wait while project assignments are being saved...",
  },
} as const satisfies Record<string, LoadingPreset>;

export const LOADING_KEY_PRIORITY = [
  "app-users-submit",
  "app-users-delete",
  "app-users-fetch",
  "employee-save",
  "employee-delete",
  "employee-create",
  "employee-projects",
  "project-create",
  "seating-assign",
  "project-detail",
  "workspace-sync",
  "session",
] as const;
