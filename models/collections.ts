/**
 * Single source of truth for MongoDB collection names used across the app.
 */
export const COLLECTIONS = {
  companies: "companies",
  appUsers: "app_users",
  appUserSeedSuppressions: "app_user_seed_suppressions",
  employees: "employees",
  employeeDetails: "employee_details",
  teams: "teams",
  companyRoles: "company_roles",
  seatingVersions: "seating_versions",
  seatingSeatHistory: "seating_seat_history",
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
