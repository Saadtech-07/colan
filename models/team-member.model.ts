import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const TEAM_MEMBER_COLLECTION = COLLECTIONS.teamMembers;

/**
 * Links an auth account to a directory employee (team membership / identity).
 * Use when a logged-in user should map 1:1 to an `employees` row.
 */
export type TeamMemberDocument = {
  _id: ObjectId;
  appUserEmail: string;
  employeeRef: ObjectId;
  linkedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
