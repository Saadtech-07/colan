/**
 * Single source of truth for MongoDB collection names used across the app.
 */
export const COLLECTIONS = {
  appUsers: "app_users",
  appUserSeedSuppressions: "app_user_seed_suppressions",
  employees: "employees",
  employeeDetails: "employee_details",
  teams: "teams",
  companyRoles: "company_roles",
  seatingBays: "seating_bays",
  seatingAssignments: "seating_assignments",
  floorPlans: "floor_plans",
  teamMembers: "team_members",
  projects: "projects",
  gallery: "gallery",
  passwordResetTokens: "password_reset_tokens",
  conversations: "conversations",
  messages: "messages",
  notifications: "notifications",
  tasks: "tasks",
  taskComments: "task_comments",
  taskActivity: "task_activity",
  dailyUpdates: "daily_updates",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
