import type { ObjectId } from "mongodb";
import type { AppRole, TeamName } from "@/types";
import { COLLECTIONS } from "./collections";

export const APP_USER_COLLECTION = COLLECTIONS.appUsers;

/**
 * Login account (Auth.js credentials): admin vs employee app access.
 * Distinct from `CompanyRole` on the employee directory record.
 */
export type AppUserDocument = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  employeeId: string;
  imageUrl: string;
  isProfileCompleted?: boolean;
  updatedProfileAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type AppUserPublicDTO = {
  id: string;
  email: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  employeeId: string;
  imageUrl: string;
  isProfileCompleted: boolean;
  updatedProfileAt?: string;
  workEmail?: string;
  phone?: string;
  location?: string;
  fullAddress?: string;
  currentAddress?: string;
  permanentAddress?: string;
  joinedDate?: string;
  bayNumber?: string;
  gender?: string;
};

export function appUserDocToPublic(doc: AppUserDocument): AppUserPublicDTO {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    appRole: doc.appRole,
    team: doc.team,
    employeeId: doc.employeeId ?? "",
    imageUrl: doc.imageUrl,
    isProfileCompleted: doc.isProfileCompleted === true,
    updatedProfileAt: doc.updatedProfileAt?.toISOString(),
  };
}
