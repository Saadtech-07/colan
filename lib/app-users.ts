import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { dicebearAvatarPng } from "@/lib/mock-data";
import { normalizeAppRole } from "@/lib/permissions";
import { COLLECTIONS, type AppUserDocument } from "@/models";
import type { AppRole, TeamName } from "@/types";

export type VerifiedAppUser = {
  email: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  imageUrl: string;
};

type SeedUser = {
  email: string;
  password: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  imageUrl: string;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "admin@colan.io",
    password: "admin123",
    name: "Alex Morgan",
    appRole: "admin",
    imageUrl: dicebearAvatarPng("admin"),
  },
  {
    email: "manager@colan.io",
    password: "manager123",
    name: "Sofia Nielsen",
    appRole: "manager",
    imageUrl: dicebearAvatarPng("sofia-mgr"),
  },
  {
    email: "lead@colan.io",
    password: "lead123",
    name: "Priya Sharma",
    appRole: "lead",
    team: "React Team",
    imageUrl: dicebearAvatarPng("priya-lead"),
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

const DEV_APP_USERS = SEED_USERS;

async function upsertSeedUser(
  col: import("mongodb").Collection<AppUserDocument>,
  u: SeedUser,
  rounds: number,
) {
  if (await col.findOne({ email: u.email })) return;
  await col.insertOne({
    _id: new ObjectId(),
    email: u.email,
    passwordHash: await bcrypt.hash(u.password, rounds),
    name: u.name,
    appRole: u.appRole,
    team: u.team,
    imageUrl: u.imageUrl,
  });
}

async function ensureAppUsersSeed(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
) {
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  await col.createIndex({ email: 1 }, { unique: true });
  const rounds = 10;
  for (const u of SEED_USERS) {
    await upsertSeedUser(col, u, rounds);
  }
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
    appRole: normalizeAppRole(doc.appRole),
    team: doc.team,
    imageUrl: doc.imageUrl,
  };
}
