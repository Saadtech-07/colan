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
  employeeId: string;
  imageUrl: string;
  isProfileCompleted?: boolean;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "admin@colan.io",
    password: "admin123",
    name: "Alex Morgan",
    appRole: "admin",
    employeeId: "COL-9001",
    imageUrl: dicebearAvatarPng("admin"),
    isProfileCompleted: true,
  },
  {
    email: "manager@colan.io",
    password: "manager123",
    name: "Sofia Nielsen",
    appRole: "manager",
    employeeId: "COL-9002",
    imageUrl: dicebearAvatarPng("sofia-mgr"),
    isProfileCompleted: true,
  },
  {
    email: "lead@colan.io",
    password: "lead123",
    name: "Priya Sharma",
    appRole: "lead",
    team: "React Team",
    employeeId: "COL-9003",
    imageUrl: dicebearAvatarPng("priya-lead"),
    isProfileCompleted: true,
  },
  {
    email: "employee@colan.io",
    password: "employee123",
    name: "Jamie Chen",
    appRole: "employee",
    team: "React Team",
    employeeId: "COL-9004",
    imageUrl: dicebearAvatarPng("jamie"),
    isProfileCompleted: true,
  },
];

const DEV_APP_USERS = SEED_USERS;

function normalizeProfileCompleted(value: boolean | undefined): boolean {
  return value ?? true;
}

async function isSeedSuppressed(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  email: string,
): Promise<boolean> {
  const suppressed = await db
    .collection<{ email: string }>(COLLECTIONS.appUserSeedSuppressions)
    .findOne({ email: email.toLowerCase().trim() });
  return Boolean(suppressed);
}

async function suppressSeedUser(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  email: string,
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  if (!SEED_USERS.some((user) => user.email === normalized)) return;

  const col = db.collection<{ email: string; suppressedAt: Date }>(
    COLLECTIONS.appUserSeedSuppressions,
  );
  await col.createIndex({ email: 1 }, { unique: true });
  await col.updateOne(
    { email: normalized },
    { $set: { email: normalized, suppressedAt: new Date() } },
    { upsert: true },
  );
}

async function upsertSeedUser(
  col: import("mongodb").Collection<AppUserDocument>,
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  u: SeedUser,
  rounds: number,
) {
  const existing = await col.findOne({ email: u.email });
  if (existing) {
    if (!existing.employeeId?.trim()) {
      await col.updateOne(
        { _id: existing._id },
        { $set: { employeeId: u.employeeId, updatedAt: new Date() } },
      );
    }
    return;
  }
  if (await isSeedSuppressed(db, u.email)) return;

  await col.insertOne({
    _id: new ObjectId(),
    email: u.email,
    passwordHash: await bcrypt.hash(u.password, rounds),
    name: u.name,
    appRole: u.appRole,
    team: u.team,
    employeeId: u.employeeId,
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
    await upsertSeedUser(col, db, u, rounds);
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
  team: TeamName;
  imageUrl?: string;
  workEmail?: string;
  phone?: string;
  location?: string;
  joinedDate?: string;
  notes?: string;
  bayNumber?: string;
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
  workspaceRole?: string;
  phone?: string;
  location?: string;
  bayNumber?: string;
};

export type AppUserSessionRefresh = {
  name: string;
  appRole: AppRole;
  team?: TeamName;
  imageUrl: string;
  isProfileCompleted: boolean;
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
  const employeeId = input.employeeId.trim();
  const existing = await col.findOne({ email });
  if (existing) throw new Error("An account with this email already exists.");

  const employeeCol = db.collection(COLLECTIONS.employees);
  const employeeIdTaken = await employeeCol.findOne({
    employeeId: { $regex: new RegExp(`^${employeeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });
  if (employeeIdTaken) {
    throw new Error("An employee with this ID already exists.");
  }

  const appUserIdTaken = await col.findOne({
    employeeId: { $regex: new RegExp(`^${employeeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });
  if (appUserIdTaken) {
    throw new Error("An account with this employee ID already exists.");
  }

  const { isValidSeatId } = await import("@/lib/seating-layout");
  const bayNumber = input.bayNumber?.trim() ?? "";
  if (bayNumber) {
    if (!isValidSeatId(bayNumber)) {
      throw new Error(
        `Invalid seat "${bayNumber}". Choose a seat from the office floor plan (e.g. A1, D3).`,
      );
    }
    const seatTaken = await employeeCol.findOne({ bayNumber });
    if (seatTaken) {
      throw new Error(`Seat ${bayNumber} is already assigned to another employee.`);
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const workEmail = (input.workEmail?.trim() || email).toLowerCase();
  const joinedDate =
    input.joinedDate?.trim() || new Date().toISOString().split("T")[0];
  const directory = {
    workEmail,
    phone: input.phone?.trim() ?? "",
    location: input.location?.trim() || "Unassigned",
    joinedDate,
    notes: input.notes?.trim() ?? "",
  };

  const doc: AppUserDocument = {
    _id: new ObjectId(),
    email,
    passwordHash,
    name: input.name.trim(),
    appRole: input.appRole,
    team: input.team,
    employeeId,
    imageUrl: input.imageUrl ?? dicebearAvatarPng(email),
    isProfileCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await col.insertOne(doc);

  const employeeRole =
    input.appRole === "admin"
      ? "Admin"
      : input.appRole === "manager"
        ? "Manager"
        : input.appRole === "lead"
          ? "Team Lead"
          : "Employee";

  const employeeObjectId = new ObjectId();
  await employeeCol.insertOne({
    _id: employeeObjectId,
    employeeId,
    email,
    name: input.name.trim(),
    role: employeeRole,
    team: input.team,
    imageUrl: input.imageUrl ?? dicebearAvatarPng(email),
    bayNumber,
    projectIds: [],
    directory,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection(COLLECTIONS.employeeDetails).updateOne(
    { employeeRef: employeeObjectId },
    {
      $set: {
        employeeRef: employeeObjectId,
        workEmail: directory.workEmail,
        phone: directory.phone || undefined,
        location: directory.location || undefined,
        joinedDate: directory.joinedDate || undefined,
        notes: directory.notes || undefined,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        _id: new ObjectId(),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

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
  if (input.employeeId !== undefined) updates.employeeId = input.employeeId.trim();
  if (input.imageUrl !== undefined) {
    updates.imageUrl = input.imageUrl.trim()
      ? input.imageUrl.trim()
      : dicebearAvatarPng(current.email);
  }
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

  const nextEmployeeId = input.employeeId?.trim() ?? current.employeeId;
  const nextName = input.name?.trim() ?? current.name;
  const nextTeam = input.team ?? current.team ?? "Unassigned";
  const nextImageUrl =
    input.imageUrl ?? current.imageUrl ?? dicebearAvatarPng(current.email);

  const employeeRole =
    nextRole === "admin"
      ? "Admin"
      : nextRole === "manager"
        ? "Manager"
        : nextRole === "lead"
          ? "Team Lead"
          : "Employee";

  const employeeSet = {
    employeeId: nextEmployeeId,
    name: nextName,
    role: employeeRole,
    team: nextTeam,
    imageUrl: nextImageUrl,
    email: current.email,
    "directory.workEmail": current.email,
  };

  const employeeFilter = {
    $or: [{ email: current.email }, { "directory.workEmail": current.email }],
  };

  const employeeUpdate = await db.collection("employees").updateOne(employeeFilter, {
    $set: employeeSet,
  });

  if (employeeUpdate.matchedCount === 0) {
    await db.collection("employees").insertOne({
      employeeId: nextEmployeeId,
      email: current.email,
      name: nextName,
      role: employeeRole,
      team: nextTeam,
      imageUrl: nextImageUrl,
      bayNumber: "",
      projectIds: [],
      directory: {
        workEmail: current.email,
        phone: "",
        location: "Unassigned",
        joinedDate: new Date().toISOString().split("T")[0],
        notes: "",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return appUserDocToPublic(result);
}

/** Keeps login accounts in sync when team member records are edited elsewhere. */
export async function syncAppUserFromEmployeeByEmail(
  workEmail: string,
  patch: {
    name?: string;
    employeeId?: string;
    team?: TeamName;
    imageUrl?: string;
  },
): Promise<void> {
  const email = workEmail.toLowerCase().trim();
  if (!email) return;

  const db = await getDb();
  if (!db) return;

  const updates: Partial<AppUserDocument> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name.trim();
  if (patch.employeeId !== undefined) updates.employeeId = patch.employeeId.trim();
  if (patch.team !== undefined) updates.team = patch.team;
  if (patch.imageUrl !== undefined) updates.imageUrl = patch.imageUrl;
  if (Object.keys(updates).length <= 1) return;

  await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .updateOne({ email }, { $set: updates });
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

  await suppressSeedUser(db, user.email);

  // Delete linked team member record when present.
  await db.collection("employees").deleteOne({
    $or: [{ email: user.email }, { "directory.workEmail": user.email }],
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

export async function getAppUserSessionRefresh(
  email: string,
): Promise<AppUserSessionRefresh | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return null;

  const db = await getDb();
  if (!db) {
    const user = DEV_APP_USERS.find((item) => item.email === normalized);
    if (!user) return null;
    return {
      name: user.name,
      appRole: user.appRole,
      team: user.team,
      imageUrl: user.imageUrl,
      isProfileCompleted: normalizeProfileCompleted(user.isProfileCompleted),
    };
  }

  await ensureAppUsersSeed(db);
  const doc = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).findOne({ email: normalized });
  if (!doc) return null;

  const appRole = normalizeAppRole(doc.appRole);
  const team =
    roleNeedsTeam(appRole) && doc.team ? (doc.team as TeamName) : undefined;

  return {
    name: doc.name,
    appRole,
    team,
    imageUrl: doc.imageUrl,
    isProfileCompleted: normalizeProfileCompleted(doc.isProfileCompleted),
  };
}

function appUserDocToProfile(
  doc: AppUserDocument,
  employeeIdFallback?: string,
): AppUserProfileDTO {
  return {
    email: doc.email,
    name: doc.name,
    appRole: doc.appRole,
    team: doc.team,
    employeeId: doc.employeeId?.trim() || employeeIdFallback || "",
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

  const employee = await db.collection(COLLECTIONS.employees).findOne({
    $or: [{ email: normalized }, { "directory.workEmail": normalized }],
  });

  const profile = appUserDocToProfile(
    doc,
    typeof employee?.employeeId === "string" ? employee.employeeId : undefined,
  );

  if (!employee) return profile;

  if (!profile.employeeId && typeof employee.employeeId === "string") {
    profile.employeeId = employee.employeeId;
  }

  profile.workspaceRole = typeof employee.role === "string" ? employee.role : undefined;
  profile.bayNumber = typeof employee.bayNumber === "string" ? employee.bayNumber : undefined;

  const embeddedDirectory = employee.directory as
    | { phone?: string; location?: string; workEmail?: string }
    | undefined;
  if (embeddedDirectory?.phone) profile.phone = embeddedDirectory.phone;
  if (embeddedDirectory?.location) profile.location = embeddedDirectory.location;

  const details = await db.collection(COLLECTIONS.employeeDetails).findOne({
    employeeRef: employee._id,
  });
  if (details) {
    if (details.phone) profile.phone = details.phone;
    if (details.location) profile.location = details.location;
  }

  return profile;
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

  const isFirstLoginSetup = !normalizeProfileCompleted(current.isProfileCompleted);

  if (isFirstLoginSetup && !wantsPasswordChange) {
    throw new Error("Set a new password to complete your first login setup.");
  }

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
