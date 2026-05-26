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
  isProfileCompleted: boolean;
};

type SeedUser = {
  email: string;
  password: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  imageUrl: string;
  isProfileCompleted?: boolean;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "admin@colan.io",
    password: "admin123",
    name: "Alex Morgan",
    appRole: "admin",
    imageUrl: dicebearAvatarPng("admin"),
    isProfileCompleted: true,
  },
  {
    email: "manager@colan.io",
    password: "manager123",
    name: "Sofia Nielsen",
    appRole: "manager",
    imageUrl: dicebearAvatarPng("sofia-mgr"),
    isProfileCompleted: true,
  },
  {
    email: "lead@colan.io",
    password: "lead123",
    name: "Priya Sharma",
    appRole: "lead",
    team: "React Team",
    imageUrl: dicebearAvatarPng("priya-lead"),
    isProfileCompleted: true,
  },
  {
    email: "employee@colan.io",
    password: "employee123",
    name: "Jamie Chen",
    appRole: "employee",
    team: "React Team",
    imageUrl: dicebearAvatarPng("jamie"),
    isProfileCompleted: true,
  },
];

const DEV_APP_USERS = SEED_USERS;

function normalizeProfileCompleted(value: boolean | undefined): boolean {
  return value ?? true;
}

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
    isProfileCompleted: normalizeProfileCompleted(u.isProfileCompleted),
    updatedProfileAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
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
  await col.updateMany(
    { isProfileCompleted: { $exists: false } },
    { $set: { isProfileCompleted: true, updatedProfileAt: new Date() } },
  );
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

export type AppUserProfileDTO = {
  email: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  employeeId: string;
  imageUrl: string;
  isProfileCompleted: boolean;
  updatedProfileAt?: string;
};

export type ProfileSetupUpdateInput = {
  email: string;
  name: string;
  imageUrl?: string;
  currentPassword?: string;
  newPassword?: string;
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
    isProfileCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await col.insertOne(doc);

/* CREATE TEAM MEMBER RECORD */

await db.collection("employees").insertOne({
  employeeId: input.employeeId,
  email: email,
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


export async function deleteAppUser(id: string) {
  const db = await getDb();

  if (!db) {
    throw new Error("MongoDB is not configured.");
  }

  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid user id.");
  }

  const col = db.collection<AppUserDocument>(
    COLLECTIONS.appUsers
  );

  // Find user before deleting
  const user = await col.findOne({
    _id: new ObjectId(id),
  });

  if (!user) {
    throw new Error("User not found.");
  }

  // Delete from app-users
  await col.deleteOne({
    _id: new ObjectId(id),
  });

  // Delete from employees collection
  await db.collection("employees").deleteOne({
    email: user.email,
  });

  return user;
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
      isProfileCompleted: normalizeProfileCompleted(u.isProfileCompleted),
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
    isProfileCompleted: normalizeProfileCompleted(doc.isProfileCompleted),
  };
}

function appUserDocToProfile(doc: AppUserDocument): AppUserProfileDTO {
  return {
    email: doc.email,
    name: doc.name,
    appRole: doc.appRole,
    team: doc.team,
    employeeId: doc.employeeId,
    imageUrl: doc.imageUrl,
    isProfileCompleted: normalizeProfileCompleted(doc.isProfileCompleted),
    updatedProfileAt: doc.updatedProfileAt?.toISOString(),
  };
}

export async function getCurrentAppUserProfile(email: string): Promise<AppUserProfileDTO> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) throw new Error("Invalid user email.");

  const db = await getDb();
  if (!db) {
    const user = DEV_APP_USERS.find((item) => item.email === normalized);
    if (!user) throw new Error("User not found.");
    return {
      email: user.email,
      name: user.name,
      appRole: user.appRole,
      team: user.team,
      employeeId: "DEV-USER",
      imageUrl: user.imageUrl,
      isProfileCompleted: normalizeProfileCompleted(user.isProfileCompleted),
      updatedProfileAt: new Date().toISOString(),
    };
  }

  await ensureAppUsersSeed(db);
  const doc = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).findOne({ email: normalized });
  if (!doc) throw new Error("User not found.");
  return appUserDocToProfile(doc);
}

export async function completeCurrentAppUserProfile(
  input: ProfileSetupUpdateInput,
): Promise<AppUserProfileDTO> {
  const email = input.email.toLowerCase().trim();
  if (!email) throw new Error("Invalid user email.");

  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");

  await ensureAppUsersSeed(db);
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  const current = await col.findOne({ email });
  if (!current) throw new Error("User not found.");

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("Full name is required.");

  const nextImageUrl = input.imageUrl?.trim() ? input.imageUrl.trim() : dicebearAvatarPng(email);
  const wantsPasswordChange = Boolean(input.newPassword);

  if (wantsPasswordChange) {
    const currentPassword = input.currentPassword?.trim() ?? "";
    if (!currentPassword) throw new Error("Current password is required to change password.");
    const ok = await bcrypt.compare(currentPassword, current.passwordHash);
    if (!ok) throw new Error("Current password is incorrect.");
  }

  const updates: Partial<AppUserDocument> = {
    name: trimmedName,
    imageUrl: nextImageUrl,
    isProfileCompleted: true,
    updatedProfileAt: new Date(),
    updatedAt: new Date(),
  };

  if (wantsPasswordChange && input.newPassword) {
    updates.passwordHash = await bcrypt.hash(input.newPassword, 10);
  }

  const updated = await col.findOneAndUpdate(
    { _id: current._id },
    { $set: updates },
    { returnDocument: "after" },
  );
  if (!updated) throw new Error("User not found.");

  await db.collection("employees").updateOne(
    {
      $or: [{ email }, { "directory.workEmail": email }],
    },
    {
      $set: {
        name: trimmedName,
        imageUrl: nextImageUrl,
        "directory.workEmail": email,
      },
    },
  );

  return appUserDocToProfile(updated);
}
