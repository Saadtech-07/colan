import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  COLLECTIONS,
  platformUserDocToPublic,
  type PlatformUserDocument,
  type PlatformUserPublicDTO,
} from "@/models";

const DEV_PLATFORM_EMAIL = "superadmin@colan.io";
const DEV_PLATFORM_PASSWORD = "superadmin123";

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

async function ensurePlatformUserSeed(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<void> {
  const col = db.collection<PlatformUserDocument>(COLLECTIONS.platformUsers);
  await col.createIndex({ email: 1 }, { unique: true });

  const env = envPlatformCredentials();
  const email = env?.email ?? DEV_PLATFORM_EMAIL;
  const existing = await col.findOne({ email });
  if (existing) return;

  const password = env?.password ?? DEV_PLATFORM_PASSWORD;
  const name = env?.name ?? "Colan Super Admin";
  const now = new Date();
  await col.insertOne({
    _id: new ObjectId(),
    email,
    passwordHash: await bcrypt.hash(password, 10),
    name,
    role: "super_admin",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
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
    const devEmail = env?.email ?? DEV_PLATFORM_EMAIL;
    const devPassword = env?.password ?? DEV_PLATFORM_PASSWORD;
    if (normalized !== devEmail || password !== devPassword) return null;
    return {
      email: devEmail,
      name: env?.name ?? "Colan Super Admin",
      platformUserId: "dev-platform-admin",
    };
  }

  await ensurePlatformUserSeed(db);
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
    const devEmail = env?.email ?? DEV_PLATFORM_EMAIL;
    if (normalized !== devEmail) return null;
    return {
      id: "dev-platform-admin",
      email: devEmail,
      name: env?.name ?? "Colan Super Admin",
      role: "super_admin",
      status: "active",
    };
  }
  await ensurePlatformUserSeed(db);
  const doc = await db
    .collection<PlatformUserDocument>(COLLECTIONS.platformUsers)
    .findOne({ email: normalized });
  return doc ? platformUserDocToPublic(doc) : null;
}

export async function listPlatformUsers(): Promise<PlatformUserPublicDTO[]> {
  const db = await getDb();
  if (!db) {
    const env = envPlatformCredentials();
    return [
      {
        id: "dev-platform-admin",
        email: env?.email ?? DEV_PLATFORM_EMAIL,
        name: env?.name ?? "Colan Super Admin",
        role: "super_admin",
        status: "active",
      },
    ];
  }
  await ensurePlatformUserSeed(db);
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
