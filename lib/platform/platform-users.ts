import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  COLLECTIONS,
  platformUserDocToPublic,
  type PlatformUserDocument,
  type PlatformUserPublicDTO,
} from "@/models";

export type VerifiedPlatformUser = {
  email: string;
  name: string;
  platformUserId: string;
};

function envPlatformCredentials(): { email: string; password: string; name: string } | null {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
  if (!email || !password) return null;
  return {
    email,
    password,
    name: process.env.SUPER_ADMIN_NAME?.trim() || "Colan Super Admin",
  };
}

export async function verifyPlatformCredentials(
  email: string,
  password: string,
): Promise<VerifiedPlatformUser | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !password) return null;

  const db = await getDb();
  if (!db) {
    const env = envPlatformCredentials();
    if (!env || normalized !== env.email || password !== env.password) return null;
    return {
      email: env.email,
      name: env.name,
      platformUserId: "dev-platform-admin",
    };
  }

  const col = db.collection<PlatformUserDocument>(COLLECTIONS.platformUsers);
  const doc = await col.findOne({ email: normalized });
  if (!doc || doc.status !== "active") return null;
  const ok = await bcrypt.compare(password, doc.passwordHash);
  if (!ok) return null;
  return {
    email: doc.email,
    name: doc.name,
    platformUserId: doc._id.toHexString(),
  };
}

export async function getPlatformUserByEmail(
  email: string,
): Promise<PlatformUserPublicDTO | null> {
  const normalized = email.toLowerCase().trim();
  const db = await getDb();
  if (!db) {
    const env = envPlatformCredentials();
    if (!env || normalized !== env.email) return null;
    return {
      id: "dev-platform-admin",
      email: env.email,
      name: env.name,
      role: "super_admin",
      status: "active",
    };
  }
  const doc = await db
    .collection<PlatformUserDocument>(COLLECTIONS.platformUsers)
    .findOne({ email: normalized });
  return doc ? platformUserDocToPublic(doc) : null;
}

export async function listPlatformUsers(): Promise<PlatformUserPublicDTO[]> {
  const db = await getDb();
  if (!db) {
    const env = envPlatformCredentials();
    if (!env) return [];
    return [
      {
        id: "dev-platform-admin",
        email: env.email,
        name: env.name,
        role: "super_admin",
        status: "active",
      },
    ];
  }
  const rows = await db
    .collection<PlatformUserDocument>(COLLECTIONS.platformUsers)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return rows.map(platformUserDocToPublic);
}

export function isPlatformAccessLevel(
  accessLevel: string | undefined,
): accessLevel is "platform" {
  return accessLevel === "platform";
}

export function isPlatformSessionUser(user: { accessLevel?: string }): boolean {
  return isPlatformAccessLevel(user.accessLevel);
}
