import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { dicebearAvatarPng } from "@/lib/mock-data";
import { normalizeAppRole, roleNeedsTeam } from "@/lib/permissions";
import {
  COLLECTIONS,
  appUserDocToPublic,
  type AppUserDocument,
} from "@/models";
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
    employeeId: `COL-${Math.floor(Math.random() * 9000) + 1000}`,
    imageUrl: u.imageUrl,
  });
}

/** Seeds demo login accounts into Atlas (idempotent). Safe to call from workspace init. */
export async function ensureAppUsersSeed(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
) {
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  await col.createIndex({ email: 1 }, { unique: true });
  const rounds = 10;
  for (const u of SEED_USERS) {
    await upsertSeedUser(col, u, rounds);
  }
}

export type AppUserCreateInput = {
  email: string;
  password: string;
  name: string;
  appRole: AppRole;
  employeeId: string;
  team?: TeamName;
  imageUrl?: string;
};

export type AppUserUpdateInput = {
  password?: string;
  name?: string;
  appRole?: AppRole;
  team?: TeamName;
  employeeId?: string;
  imageUrl?: string;
};

export async function listAppUsers(): Promise<ReturnType<typeof appUserDocToPublic>[]> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");
  await ensureAppUsersSeed(db);
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  const docs = await col.find({}).sort({ email: 1 }).toArray();
  return docs.map(appUserDocToPublic);
}

export async function createAppUser(
  input: AppUserCreateInput,
): Promise<ReturnType<typeof appUserDocToPublic>> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");
  await ensureAppUsersSeed(db);
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  const email = input.email.toLowerCase().trim();
  const existing = await col.findOne({ email });
  if (existing) throw new Error("An account with this email already exists.");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const doc: AppUserDocument = {
    _id: new ObjectId(),
    email,
    passwordHash,
    name: input.name.trim(),
    appRole: input.appRole,
    team: input.team,
    employeeId: input.employeeId,
    imageUrl: input.imageUrl ?? dicebearAvatarPng(email),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await col.insertOne(doc);

/* CREATE TEAM MEMBER RECORD */

await db.collection("employees").insertOne({
  employeeId: input.employeeId,

  name: input.name.trim(),

  role:
    input.appRole === "admin"
      ? "Admin"
      : input.appRole === "manager"
      ? "Manager"
      : input.appRole === "lead"
      ? "Team Lead"
      : "Employee",

  team: input.team || "Unassigned",

  imageUrl: input.imageUrl ?? dicebearAvatarPng(email),

  bayNumber: "",

  projectIds: [],

  directory: {
    workEmail: email,
    phone: "",
    location: "Unassigned",
    joinedDate: new Date().toISOString().split("T")[0],
    notes: "",
  },
});

return appUserDocToPublic(doc);
}

export async function updateAppUser(  
  id: string,
  input: AppUserUpdateInput,
): Promise<ReturnType<typeof appUserDocToPublic>> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  if (!ObjectId.isValid(id)) throw new Error("Invalid user id.");

  const current = await col.findOne({ _id: new ObjectId(id) });
  if (!current) throw new Error("User not found.");

  const nextRole = input.appRole ?? current.appRole;
  const updates: Partial<AppUserDocument> = {
    updatedAt: new Date(),
  };
  const unset: Record<string, ""> = {};

  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.appRole !== undefined) updates.appRole = input.appRole;
  if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;
  if (input.password) {
    updates.passwordHash = await bcrypt.hash(input.password, 10);
  }

  if (roleNeedsTeam(nextRole)) {
    if (input.team !== undefined) updates.team = input.team;
  } else {
    unset.team = "";
  }

  const updateDoc: { $set: Partial<AppUserDocument>; $unset?: Record<string, ""> } = {
    $set: updates,
  };
  if (Object.keys(unset).length > 0) updateDoc.$unset = unset;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    updateDoc,
    { returnDocument: "after" },
  );

  if (!result) throw new Error("User not found.");

  await db.collection("employees").updateOne(
    {
      "directory.workEmail": current.email,
    },
    {
      $set: {
        employeeId: input.employeeId ?? current.employeeId,
  
        name: input.name?.trim() ?? current.name,
  
        role:
          (input.appRole ?? current.appRole) === "admin"
            ? "Admin"
            : (input.appRole ?? current.appRole) === "manager"
            ? "Manager"
            : (input.appRole ?? current.appRole) === "lead"
            ? "Team Lead"
            : "Employee",
  
        team: input.team ?? current.team ?? "Unassigned",
  
        imageUrl:
          input.imageUrl ??
          current.imageUrl ??
          dicebearAvatarPng(current.email),
  
        "directory.workEmail": current.email,
      },
    }
  );
  return appUserDocToPublic(result);
}


export async function deleteAppUser(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");
  if (!ObjectId.isValid(id)) throw new Error("Invalid user id.");
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  await col.deleteOne({ _id: new ObjectId(id) });
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
  const appRole = normalizeAppRole(doc.appRole);
  const seedRow = SEED_USERS.find((s) => s.email === normalized);
  const teamFromSeed = seedRow?.team;
  const team =
    roleNeedsTeam(appRole) && (doc.team ?? teamFromSeed)
      ? ((doc.team ?? teamFromSeed) as TeamName)
      : undefined;
  return {
    email: doc.email,
    name: doc.name,
    appRole,
    team,
    imageUrl: doc.imageUrl,
  };
}
