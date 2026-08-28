import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { normalizeAppRole, roleNeedsEmployeeIdentity, roleNeedsTeam } from "@/lib/permissions";
import {
  COLLECTIONS,
  appUserDocToPublic,
  type AppUserDocument,
} from "@/models";
import type { AppRole, TeamName } from "@/types";
import {
  isProjectManagerAppRole,
} from "@/lib/project-managers";
import {
  isTeamLeadAppRole,
  isTeamManagerAppRole,
  type TeamAssignableAccount,
} from "@/lib/team-assignees";
import type { ProjectManagerSummary } from "@/types";
import { addressesFromDirectory, directoryPatchFromAddresses } from "@/lib/employee-address";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { getRoleFromRegistry } from "@/lib/role-registry";
import { resolveDefaultCompanyId } from "@/lib/companies";
import { DEMO_COMPANY_ID, toCompanyObjectId } from "@/lib/tenant-scope";
import { isValidSeatId } from "@/lib/seating-layout";
import {
  roleEligibleForOfficeSeat,
  roleShowsTeamOnProfile,
} from "@/lib/workspace-identity";

export type VerifiedAppUser = {
  email: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  imageUrl: string;
  isProfileCompleted: boolean;
  companyId: string;
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
    imageUrl: "",
    isProfileCompleted: true,
  },
  {
    email: "manager@colan.io",
    password: "manager123",
    name: "Sofia Nielsen",
    appRole: "manager",
    employeeId: "COL-9002",
    imageUrl: "",
    isProfileCompleted: true,
  },
  {
    email: "lead@colan.io",
    password: "lead123",
    name: "Priya Sharma",
    appRole: "lead",
    team: "React Team",
    employeeId: "COL-9003",
    imageUrl: "",
    isProfileCompleted: true,
  },
  {
    email: "employee@colan.io",
    password: "employee123",
    name: "Jamie Chen",
    appRole: "employee",
    team: "React Team",
    employeeId: "COL-9004",
    imageUrl: "",
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
  companyId: import("mongodb").ObjectId,
) {
  const existing = await col.findOne({ email: u.email });
  if (existing) {
    if (!existing.companyId) {
      await col.updateOne({ _id: existing._id }, { $set: { companyId, updatedAt: new Date() } });
    }
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
    companyId,
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
  const { ensureDefaultCompany } = await import("@/lib/tenant-migration");
  const companyId = await ensureDefaultCompany(db);
  const rounds = 10;
  for (const u of SEED_USERS) {
    await upsertSeedUser(col, db, u, rounds, companyId);
  }
  await col.updateMany(
    { isProfileCompleted: { $exists: false } },
    { $set: { isProfileCompleted: true, updatedProfileAt: new Date() } },
  );
}

export type AppUserCreateInput = {
  email: string;
  personalEmail?: string;
  password: string;
  name: string;
  appRole: AppRole;
  team?: TeamName;
  employeeId?: string;
  imageUrl?: string;
  workEmail?: string;
  phone?: string;
  location?: string;
  fullAddress?: string;
  currentAddress?: string;
  permanentAddress?: string;
  joinedDate?: string;
  notes?: string;
  bayNumber?: string;
  gender?: import("@/types").Gender;
};

export type AppUserUpdateInput = {
  password?: string;
  name?: string;
  appRole?: AppRole;
  team?: TeamName;
  employeeId?: string;
  imageUrl?: string;
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  location?: string;
  fullAddress?: string;
  currentAddress?: string;
  permanentAddress?: string;
  joinedDate?: string;
  bayNumber?: string;
  gender?: import("@/types").Gender;
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
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  /** @deprecated Legacy single-line location; prefer currentAddress. */
  location?: string;
  currentAddress?: string;
  permanentAddress?: string;
  joinedDate?: string;
  bayNumber?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumeMimeType?: string;
  resumeUploadedAt?: string;
};

export type AppUserSessionRefresh = {
  name: string;
  appRole: AppRole;
  team?: TeamName;
  imageUrl: string;
  isProfileCompleted: boolean;
  companyId: string;
};

export type ProfileSetupUpdateInput = {
  email: string;
  imageUrl?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumeMimeType?: string;
  currentPassword?: string;
  newPassword?: string;
};

export async function listAppUsers(companyId: string): Promise<ReturnType<typeof appUserDocToPublic>[]> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");
  await ensureAppUsersSeed(db);
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  const docs = await col
    .find({ companyId: toCompanyObjectId(companyId) })
    .sort({ email: 1 })
    .toArray();
  const users = docs.map(appUserDocToPublic);
  return enrichAppUsersWithEmployeeProfiles(users, db);
}

async function enrichAppUsersWithEmployeeProfiles(
  users: ReturnType<typeof appUserDocToPublic>[],
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<ReturnType<typeof appUserDocToPublic>[]> {
  if (!users.length || !db) return users;

  const emails = users.map((user) => user.email.toLowerCase());
  const employeeCol = db.collection(COLLECTIONS.employees);
  const rows = await employeeCol
    .find({
      $or: [{ email: { $in: emails } }, { "directory.workEmail": { $in: emails } }],
    })
    .toArray();

  const byEmail = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const loginEmail = typeof row.email === "string" ? row.email.toLowerCase() : "";
    const workEmail =
      typeof row.directory?.workEmail === "string"
        ? row.directory.workEmail.toLowerCase()
        : "";
    if (loginEmail) byEmail.set(loginEmail, row);
    if (workEmail) byEmail.set(workEmail, row);
  }

  return users.map((user) => {
    const employee = byEmail.get(user.email.toLowerCase());
    if (!employee) return user;
    const directory = (employee.directory ?? {}) as {
      workEmail?: string;
      personalEmail?: string;
      phone?: string;
      location?: string;
      fullAddress?: string;
      currentAddress?: string;
      permanentAddress?: string;
      joinedDate?: string;
    };
    return {
      ...user,
      workEmail: directory.workEmail ?? user.email,
      personalEmail: directory.personalEmail ?? "",
      phone: directory.phone ?? "",
      location: directory.location ?? "",
      fullAddress: directory.fullAddress ?? directory.location ?? "",
      currentAddress: directory.currentAddress ?? "",
      permanentAddress: directory.permanentAddress ?? "",
      joinedDate: directory.joinedDate ?? "",
      bayNumber: typeof employee.bayNumber === "string" ? employee.bayNumber : "",
      gender:
        typeof employee.gender === "string" && employee.gender.length > 0
          ? employee.gender
          : "male",
    };
  });
}

export async function getAppUserPublicById(
  id: string,
): Promise<ReturnType<typeof appUserDocToPublic> | null> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(id)) return null;
  await ensureAppUsersSeed(db);
  const doc = await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .findOne({ _id: new ObjectId(id) });
  return doc ? appUserDocToPublic(doc) : null;
}

export async function listProjectManagerAccounts(companyId: string): Promise<ProjectManagerSummary[]> {
  await ensureRoleRegistry(companyId);
  const users = await listAppUsers(companyId);
  return users
    .filter((user) => isProjectManagerAppRole(user.appRole))
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
      appRole: user.appRole,
    }));
}

function toTeamAssignableAccount(
  user: ReturnType<typeof appUserDocToPublic>,
): TeamAssignableAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    appRole: user.appRole,
    team: user.team,
  };
}

export async function listTeamAssignableAccounts(companyId: string): Promise<TeamAssignableAccount[]> {
  await ensureRoleRegistry(companyId);
  const users = await listAppUsers(companyId).then((rows) => rows.map(toTeamAssignableAccount));
  return users.filter(
    (user) => isTeamLeadAppRole(user.appRole) || isTeamManagerAppRole(user.appRole),
  );
}

export async function createAppUser(
  companyId: string,
  input: AppUserCreateInput,
): Promise<ReturnType<typeof appUserDocToPublic>> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");
  await ensureAppUsersSeed(db);
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  const email = input.email.toLowerCase().trim();
  const needsEmployeeIdentity = roleNeedsEmployeeIdentity(input.appRole);
  const userId = input.employeeId?.trim() ?? "";
  const team = needsEmployeeIdentity ? input.team : undefined;

  if (!userId) throw new Error("User ID is required.");
  if (needsEmployeeIdentity && !team) throw new Error("Team is required for this role.");

  const existing = await col.findOne({ email });
  if (existing) throw new Error("An account with this email already exists.");

  const employeeCol = db.collection(COLLECTIONS.employees);
  const scope = { companyId: toCompanyObjectId(companyId) };

  const userIdPattern = new RegExp(
    `^${userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    "i",
  );
  const appUserIdTaken = await col.findOne({ ...scope, employeeId: { $regex: userIdPattern } });
  if (appUserIdTaken) {
    throw new Error("An account with this user ID already exists.");
  }

  if (needsEmployeeIdentity) {
    const employeeIdTaken = await employeeCol.findOne({
      ...scope,
      employeeId: { $regex: userIdPattern },
    });
    if (employeeIdTaken) {
      throw new Error("An employee with this user ID already exists.");
    }
  }

  const { isValidSeatId } = await import("@/lib/seating-layout");
  const bayNumber = needsEmployeeIdentity ? input.bayNumber?.trim() ?? "" : "";
  if (needsEmployeeIdentity && bayNumber) {
    if (!isValidSeatId(bayNumber)) {
      throw new Error(
        `Invalid seat "${bayNumber}". Choose a seat from the office floor plan (e.g. A1, D3).`,
      );
    }
    const seatTaken = await employeeCol.findOne({ ...scope, bayNumber });
    if (seatTaken) {
      throw new Error(`Seat ${bayNumber} is already assigned to another employee.`);
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const loginEmail = email;
  const workEmail = (input.workEmail?.trim() || loginEmail).toLowerCase();
  const personalEmail = input.personalEmail?.trim().toLowerCase() ?? "";
  const joinedDate =
    input.joinedDate?.trim() || new Date().toISOString().split("T")[0];
  const directory = directoryPatchFromAddresses(
    {
      currentAddress:
        input.currentAddress?.trim() ??
        input.fullAddress?.trim() ??
        input.location?.trim() ??
        "",
      permanentAddress: input.permanentAddress?.trim() ?? "",
    },
    {
      workEmail,
      personalEmail: personalEmail || undefined,
      phone: input.phone?.trim() ?? "",
      joinedDate,
      notes: input.notes?.trim() ?? "",
    },
  );

  const doc: AppUserDocument = {
    _id: new ObjectId(),
    companyId: toCompanyObjectId(companyId),
    email: loginEmail,
    passwordHash,
    name: input.name.trim(),
    appRole: input.appRole,
    ...(team ? { team } : {}),
    employeeId: userId,
    imageUrl: input.imageUrl?.trim() ?? "",
    isProfileCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await col.insertOne(doc);

  if (!needsEmployeeIdentity) {
    return appUserDocToPublic(doc);
  }

  const roleRegistry = await ensureRoleRegistry(companyId);
  const employeeRole =
    roleRegistry.get(normalizeAppRole(input.appRole))?.name ?? "Employee";

  const employeeObjectId = new ObjectId();
  const nextGender = input.gender ?? "male";
  await employeeCol.insertOne({
    _id: employeeObjectId,
    companyId: toCompanyObjectId(companyId),
    employeeId: userId,
    email: loginEmail,
    name: input.name.trim(),
    role: employeeRole,
    team,
    gender: nextGender,
    imageUrl: input.imageUrl?.trim() ?? "",
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
        personalEmail: directory.personalEmail,
        phone: directory.phone || undefined,
        location: directory.location || undefined,
        fullAddress: directory.fullAddress || undefined,
        currentAddress: directory.currentAddress || undefined,
        permanentAddress: directory.permanentAddress || undefined,
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

  const userObjectId = new ObjectId(id);
  const current = await col.findOne({ _id: userObjectId });
  if (!current) throw new Error("User not found.");

  const nextRole = input.appRole ?? current.appRole;
  const updates: Partial<AppUserDocument> = {
    updatedAt: new Date(),
  };
  const unset: Record<string, ""> = {};

  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.appRole !== undefined) updates.appRole = input.appRole;
  if (input.imageUrl !== undefined) {
    updates.imageUrl = input.imageUrl.trim();
  }
  if (input.password) {
    updates.passwordHash = await bcrypt.hash(input.password, 10);
  }

  if (roleNeedsTeam(nextRole)) {
    if (input.team !== undefined) updates.team = input.team;
  } else {
    unset.team = "";
  }

  if (input.employeeId !== undefined) {
    const trimmedUserId = input.employeeId.trim();
    if (!trimmedUserId) throw new Error("User ID is required.");
    const currentUserId = (current.employeeId ?? "").trim();
    if (trimmedUserId.toLowerCase() !== currentUserId.toLowerCase()) {
      const userIdPattern = new RegExp(
        `^${trimmedUserId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
      );
      const duplicateUserId = await col.findOne({
        employeeId: { $regex: userIdPattern },
        _id: { $ne: userObjectId },
      });
      if (duplicateUserId) {
        throw new Error("An account with this user ID already exists.");
      }
    }
    updates.employeeId = trimmedUserId;
  }

  const updateDoc: { $set: Partial<AppUserDocument>; $unset?: Record<string, ""> } = {
    $set: updates,
  };
  if (Object.keys(unset).length > 0) updateDoc.$unset = unset;

  const result = await col.findOneAndUpdate(
    { _id: userObjectId },
    updateDoc,
    { returnDocument: "after" },
  );

  if (!result) throw new Error("User not found.");

  if (!roleNeedsEmployeeIdentity(nextRole)) {
    await db.collection("employees").deleteOne({
      $or: [{ email: current.email }, { "directory.workEmail": current.email }],
    });
    return appUserDocToPublic(result);
  }

  const nextEmployeeId =
    input.employeeId?.trim() || current.employeeId?.trim() || "";
  const nextName = input.name?.trim() ?? current.name;
  const nextTeam = input.team ?? current.team ?? "Unassigned";
  const nextImageUrl = input.imageUrl ?? current.imageUrl ?? "";
  const nextWorkEmail = (input.workEmail?.trim() || current.email).toLowerCase();
  const nextPersonalEmail = input.personalEmail?.trim().toLowerCase() ?? "";
  const nextPhone = input.phone?.trim() ?? "";
  const nextDirectory = directoryPatchFromAddresses(
    {
      currentAddress:
        input.currentAddress?.trim() ??
        input.fullAddress?.trim() ??
        input.location?.trim() ??
        "",
      permanentAddress: input.permanentAddress?.trim() ?? "",
    },
    {
      workEmail: nextWorkEmail,
      personalEmail: nextPersonalEmail || undefined,
      phone: nextPhone || undefined,
      joinedDate: input.joinedDate?.trim() || new Date().toISOString().split("T")[0],
    },
  );
  const nextJoinedDate = nextDirectory.joinedDate ?? new Date().toISOString().split("T")[0];

  const employeeCol = db.collection(COLLECTIONS.employees);
  const employeeFilter = {
    $or: [{ email: current.email }, { "directory.workEmail": current.email }],
  };
  const existingEmployee = await employeeCol.findOne(employeeFilter);

  let nextBayNumber = existingEmployee?.bayNumber ?? "";
  if (input.bayNumber !== undefined) {
    const trimmedBay = input.bayNumber.trim();
    if (!trimmedBay || trimmedBay === "__unassigned__") {
      nextBayNumber = "";
    } else if (trimmedBay !== (existingEmployee?.bayNumber ?? "")) {
      if (!isValidSeatId(trimmedBay)) {
        throw new Error(
          `Invalid seat "${trimmedBay}". Choose a seat from the office floor plan (e.g. A1, D3).`,
        );
      }
      const seatTaken = await employeeCol.findOne({
        bayNumber: trimmedBay,
        $nor: [{ email: current.email }, { "directory.workEmail": current.email }],
      });
      if (seatTaken) {
        throw new Error(`Seat ${trimmedBay} is already assigned to another employee.`);
      }
      nextBayNumber = trimmedBay;
    } else {
      nextBayNumber = trimmedBay;
    }
  }

  let employeeRole =
    getRoleFromRegistry(normalizeAppRole(nextRole))?.name ?? null;
  if (!employeeRole) {
    const roleRegistry = await ensureRoleRegistry();
    employeeRole =
      roleRegistry.get(normalizeAppRole(nextRole))?.name ?? "Employee";
  }

  const employeeSet = {
    employeeId: nextEmployeeId,
    name: nextName,
    role: employeeRole,
    team: nextTeam,
    imageUrl: nextImageUrl,
    email: current.email,
    bayNumber: nextBayNumber,
    ...(input.gender !== undefined ? { gender: input.gender } : {}),
    "directory.workEmail": nextWorkEmail,
    "directory.personalEmail": nextPersonalEmail,
    "directory.phone": nextPhone,
    "directory.location": nextDirectory.location ?? "",
    "directory.fullAddress": nextDirectory.fullAddress ?? "",
    "directory.currentAddress": nextDirectory.currentAddress ?? "",
    "directory.permanentAddress": nextDirectory.permanentAddress ?? "",
    "directory.joinedDate": nextJoinedDate,
    updatedAt: new Date(),
  };

  const employeeUpdate = await employeeCol.updateOne(employeeFilter, {
    $set: employeeSet,
  });

  let employeeRef = existingEmployee?._id;

  if (employeeUpdate.matchedCount === 0) {
    employeeRef = new ObjectId();
    await employeeCol.insertOne({
      _id: employeeRef,
      employeeId: nextEmployeeId,
      email: current.email,
      name: nextName,
      role: employeeRole,
      team: nextTeam,
      gender: input.gender ?? "male",
      imageUrl: nextImageUrl,
      bayNumber: nextBayNumber,
      projectIds: [],
      directory: {
        workEmail: nextWorkEmail,
        personalEmail: nextPersonalEmail || undefined,
        phone: nextPhone,
        location: nextDirectory.location ?? "",
        fullAddress: nextDirectory.fullAddress ?? "",
        currentAddress: nextDirectory.currentAddress ?? "",
        permanentAddress: nextDirectory.permanentAddress ?? "",
        joinedDate: nextJoinedDate,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else if (!employeeRef) {
    const refreshed = await employeeCol.findOne(employeeFilter, {
      projection: { _id: 1 },
    });
    employeeRef = refreshed?._id;
  }

  if (employeeRef) {
    await db.collection(COLLECTIONS.employeeDetails).updateOne(
      { employeeRef },
      {
        $set: {
          employeeRef,
          workEmail: nextWorkEmail,
          personalEmail: nextPersonalEmail || undefined,
          phone: nextPhone || undefined,
          location: nextDirectory.location || undefined,
          fullAddress: nextDirectory.fullAddress || undefined,
          currentAddress: nextDirectory.currentAddress || undefined,
          permanentAddress: nextDirectory.permanentAddress || undefined,
          joinedDate: nextJoinedDate || undefined,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
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

  const employeeCol = db.collection(COLLECTIONS.employees);
  const detailsCol = db.collection(COLLECTIONS.employeeDetails);
  const normalizedEmail = user.email.toLowerCase().trim();

  const employeeFilters: Record<string, unknown>[] = [
    { email: normalizedEmail },
    { "directory.workEmail": normalizedEmail },
    { "directory.personalEmail": normalizedEmail },
  ];
  if (user.employeeId?.trim()) {
    employeeFilters.push({ employeeId: user.employeeId.trim() });
  }

  const detailMatches = await detailsCol
    .find({ workEmail: normalizedEmail })
    .toArray();
  for (const detail of detailMatches) {
    employeeFilters.push({ _id: detail.employeeRef });
  }

  const linkedEmployees = await employeeCol
    .find({ $or: employeeFilters })
    .project({ _id: 1 })
    .toArray();

  if (linkedEmployees.length > 0) {
    const refs = linkedEmployees.map((row) => row._id);
    await detailsCol.deleteMany({ employeeRef: { $in: refs } });
    await employeeCol.deleteMany({ _id: { $in: refs } });
  }

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
      companyId: DEMO_COMPANY_ID,
    };
  }

  await ensureAppUsersSeed(db);
  const col = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  let doc = await col.findOne({ email: normalized });
  if (!doc) {
    const employeeCol = db.collection(COLLECTIONS.employees);
    const linkedEmployee = await employeeCol.findOne({
      $or: [{ email: normalized }, { "directory.workEmail": normalized }],
    });
    const linkedLoginEmail =
      typeof linkedEmployee?.email === "string"
        ? linkedEmployee.email.toLowerCase().trim()
        : "";
    if (linkedLoginEmail) {
      doc = await col.findOne({ email: linkedLoginEmail });
    }
  }
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
    companyId: doc.companyId?.toHexString() ?? (await resolveDefaultCompanyId()),
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
      companyId: DEMO_COMPANY_ID,
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
    companyId: doc.companyId?.toHexString() ?? (await resolveDefaultCompanyId()),
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
      workEmail: user.email,
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

  if (!employee) {
    profile.workEmail = doc.email;
    if (!roleShowsTeamOnProfile(doc.appRole)) {
      profile.team = undefined;
    }
    if (!roleEligibleForOfficeSeat(doc.appRole)) {
      profile.bayNumber = undefined;
    }
    return profile;
  }

  if (!profile.employeeId && typeof employee.employeeId === "string") {
    profile.employeeId = employee.employeeId;
  }

  if (!profile.team && typeof employee.team === "string") {
    profile.team = employee.team as TeamName;
  }

  profile.workspaceRole = typeof employee.role === "string" ? employee.role : undefined;
  profile.bayNumber = typeof employee.bayNumber === "string" ? employee.bayNumber : undefined;

  const embeddedDirectory = employee.directory as
    | {
        phone?: string;
        location?: string;
        workEmail?: string;
        joinedDate?: string;
        fullAddress?: string;
        currentAddress?: string;
        permanentAddress?: string;
      }
    | undefined;

  const details = await db.collection(COLLECTIONS.employeeDetails).findOne({
    employeeRef: employee._id,
  });

  const mergedDirectory = {
    location: details?.location ?? embeddedDirectory?.location,
    fullAddress: details?.fullAddress ?? embeddedDirectory?.fullAddress,
    currentAddress: details?.currentAddress ?? embeddedDirectory?.currentAddress,
    permanentAddress: details?.permanentAddress ?? embeddedDirectory?.permanentAddress,
    workEmail: embeddedDirectory?.workEmail ?? details?.workEmail,
    phone: details?.phone ?? embeddedDirectory?.phone,
    joinedDate: details?.joinedDate ?? embeddedDirectory?.joinedDate,
  };

  profile.workEmail = mergedDirectory.workEmail?.trim() || doc.email;
  profile.phone = mergedDirectory.phone?.trim() || undefined;
  profile.joinedDate = mergedDirectory.joinedDate?.trim() || undefined;

  const { currentAddress, permanentAddress } = addressesFromDirectory(mergedDirectory);
  profile.currentAddress = currentAddress || undefined;
  profile.permanentAddress = permanentAddress || undefined;
  profile.location = currentAddress || mergedDirectory.location?.trim() || undefined;

  const embeddedResume = embeddedDirectory as
    | {
        resumeUrl?: string;
        resumeFileName?: string;
        resumeMimeType?: string;
        resumeUploadedAt?: string;
      }
    | undefined;

  const resumeSource = details?.resumeUrl?.trim()
    ? details
    : embeddedResume?.resumeUrl?.trim()
      ? embeddedResume
      : null;

  if (resumeSource?.resumeUrl?.trim()) {
    profile.resumeUrl = resumeSource.resumeUrl.trim();
    profile.resumeFileName = resumeSource.resumeFileName?.trim() || "resume.pdf";
    profile.resumeMimeType = resumeSource.resumeMimeType?.trim() || "application/pdf";
    profile.resumeUploadedAt = resumeSource.resumeUploadedAt?.trim() || undefined;
  } else {
    profile.resumeUrl = "";
  }

  if (!roleShowsTeamOnProfile(doc.appRole)) {
    profile.team = undefined;
  }
  if (!roleEligibleForOfficeSeat(doc.appRole)) {
    profile.bayNumber = undefined;
  }

  return profile;
}

type ResumePatch = {
  resumeUrl: string;
  resumeFileName?: string;
  resumeMimeType?: string;
};

async function upsertLinkedEmployeeResume(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  email: string,
  resume: ResumePatch,
) {
  const employee = await db.collection(COLLECTIONS.employees).findOne({
    $or: [{ email }, { "directory.workEmail": email }],
  });
  if (!employee) return;

  const employeeRef = employee._id;
  const employeeCol = db.collection(COLLECTIONS.employees);
  const detailsCol = db.collection(COLLECTIONS.employeeDetails);

  if (!resume.resumeUrl.trim()) {
    await detailsCol.updateOne(
      { employeeRef },
      {
        $unset: {
          resumeUrl: "",
          resumeFileName: "",
          resumeMimeType: "",
          resumeUploadedAt: "",
        },
        $set: { updatedAt: new Date() },
      },
    );
    await employeeCol.updateOne(
      { _id: employeeRef },
      {
        $unset: {
          "directory.resumeUrl": "",
          "directory.resumeFileName": "",
          "directory.resumeMimeType": "",
          "directory.resumeUploadedAt": "",
        },
        $set: { updatedAt: new Date() },
      },
    );
    return;
  }

  const uploadedAt = new Date().toISOString();
  const resumeFileName = resume.resumeFileName?.trim() || "resume.pdf";
  const resumeMimeType = resume.resumeMimeType?.trim() || "application/pdf";

  await detailsCol.updateOne(
    { employeeRef },
    {
      $set: {
        employeeRef,
        resumeUrl: resume.resumeUrl.trim(),
        resumeFileName,
        resumeMimeType,
        resumeUploadedAt: uploadedAt,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        _id: new ObjectId(),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  await employeeCol.updateOne(
    { _id: employeeRef },
    {
      $set: {
        "directory.resumeUrl": resume.resumeUrl.trim(),
        "directory.resumeFileName": resumeFileName,
        "directory.resumeMimeType": resumeMimeType,
        "directory.resumeUploadedAt": uploadedAt,
        updatedAt: new Date(),
      },
    },
  );
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

  const nextImageUrl = input.imageUrl?.trim() ?? "";
  const wantsPasswordChange = Boolean(input.newPassword?.trim());

  if (wantsPasswordChange) {
    const currentPassword = input.currentPassword?.trim() ?? "";
    if (!currentPassword) throw new Error("Current password is required to change password.");
    const ok = await bcrypt.compare(currentPassword, current.passwordHash);
    if (!ok) throw new Error("Current password is incorrect.");
  }

  const updates: Partial<AppUserDocument> = {
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

  await db.collection(COLLECTIONS.employees).updateOne(
    {
      $or: [{ email }, { "directory.workEmail": email }],
    },
    {
      $set: {
        imageUrl: nextImageUrl,
      },
    },
  );

  if (input.resumeUrl !== undefined) {
    await upsertLinkedEmployeeResume(db, email, {
      resumeUrl: input.resumeUrl.trim(),
      resumeFileName: input.resumeFileName,
      resumeMimeType: input.resumeMimeType,
    });
  }

  return getCurrentAppUserProfile(email);
}
