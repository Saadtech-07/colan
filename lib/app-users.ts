import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { dicebearAvatarPng } from "@/lib/mock-data";
import { COLLECTIONS, type AppUserDocument } from "@/models";
import type { AppRole, TeamName } from "@/types";

export type VerifiedAppUser = {
  email: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  imageUrl: string;
};

/** Used when MONGODB_URI is unset (same accounts as first-time Atlas seed). */
const DEV_APP_USERS: Array<{
  email: string;
  password: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  imageUrl: string;
}> = [
  {
    email: "admin@colan.io",
    password: "admin123",
    name: "Alex Morgan",
    appRole: "admin",
    imageUrl: dicebearAvatarPng("admin"),
  },
  {
    email: "employee@colan.io",
    password: "employee123",
    name: "Jamie Chen",
    appRole: "employee",
    team: "React Team",
    imageUrl: dicebearAvatarPng("jamie"),
  },
];

async function ensureAppUsersSeed(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
) {
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  await col.createIndex({ email: 1 }, { unique: true });
  if ((await col.countDocuments()) > 0) return;
  const rounds = 10;
  const seeds = [
    {
      email: "admin@colan.io",
      plain: "admin123",
      name: "Alex Morgan",
      appRole: "admin" as const,
      team: undefined as TeamName | undefined,
      imageUrl: dicebearAvatarPng("admin"),
    },
    {
      email: "employee@colan.io",
      plain: "employee123",
      name: "Jamie Chen",
      appRole: "employee" as const,
      team: "React Team" as TeamName,
      imageUrl: dicebearAvatarPng("jamie"),
    },
  ];
  const docs: AppUserDocument[] = await Promise.all(
    seeds.map(async (u) => ({
      _id: new ObjectId(),
      email: u.email,
      passwordHash: await bcrypt.hash(u.plain, rounds),
      name: u.name,
      appRole: u.appRole,
      team: u.team,
      imageUrl: u.imageUrl,
    })),
  );
  await col.insertMany(docs);
}

export async function verifyAppUserCredentials(
  email: string,
  password: string,
): Promise<VerifiedAppUser | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !password) return null;

  const db = await getDb();
  if (!db) {
    const u = DEV_APP_USERS.find((x) => x.email === normalized);
    if (!u || u.password !== password) return null;
    return {
      email: u.email,
      name: u.name,
      appRole: u.appRole,
      team: u.team,
      imageUrl: u.imageUrl,
    };
  }

  await ensureAppUsersSeed(db);
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  const doc = await col.findOne({ email: normalized });
  if (!doc) return null;
  const ok = await bcrypt.compare(password, doc.passwordHash);
  if (!ok) return null;
  return {
    email: doc.email,
    name: doc.name,
    appRole: doc.appRole,
    team: doc.team,
    imageUrl: doc.imageUrl,
  };
}
