import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const PLATFORM_USER_COLLECTION = COLLECTIONS.platformUsers;

export type PlatformUserStatus = "active" | "disabled";

export type PlatformUserDocument = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: "super_admin";
  status: PlatformUserStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

export type PlatformUserPublicDTO = {
  id: string;
  email: string;
  name: string;
  role: "super_admin";
  status: PlatformUserStatus;
  createdAt?: string;
};

export function platformUserDocToPublic(doc: PlatformUserDocument): PlatformUserPublicDTO {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    status: doc.status,
    createdAt: doc.createdAt?.toISOString(),
  };
}
