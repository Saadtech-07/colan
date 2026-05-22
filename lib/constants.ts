import type { CompanyRole } from "@/types";
import { DEFAULT_TEAM_NAMES } from "@/lib/team-utils";

/** @deprecated Use workspace teams from API / `useAppState().workspaceTeams`. */
export const TEAMS = [...DEFAULT_TEAM_NAMES];

export const COMPANY_ROLES: CompanyRole[] = [
  "Admin",
  "Manager",
  "Team Lead",
  "Employee",
  "Intern",
];

export { ALL_SEAT_IDS as ALL_BAY_IDS, isValidSeatId } from "@/lib/seating-layout";
