import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  emptyModulePermissions,
  normalizeModulePermissions,
  type ModulePermissionsMap,
} from "@/lib/rbac-modules";
import { SYSTEM_ROLE_SEEDS, type SystemRoleSeed } from "@/lib/rbac-seed";
import { invalidateServerRoleCache } from "@/lib/role-registry.server";
import { teamSlugFromName } from "@/lib/team-utils";
import {
  COLLECTIONS,
  companyRoleDocToDTO,
  ensureColanModelIndexes,
  type CompanyRoleDocument,
  type WorkspaceRole,
} from "@/models";

const memoryRoles: WorkspaceRole[] = [];

function isDuplicateKeyError(e: unknown): boolean {
  return e instanceof MongoServerError && (e.code === 11000 || e.code === 11001);
}

function seedForKey(key: string): SystemRoleSeed | undefined {
  return SYSTEM_ROLE_SEEDS.find((s) => s.key === key);
}

function docToWorkspaceRole(doc: CompanyRoleDocument): WorkspaceRole {
  const seed = seedForKey(doc.key);
  return companyRoleDocToDTO(doc, seed?.permissions);
}

function cloneMemoryRolesFromSeed(): WorkspaceRole[] {
  return SYSTEM_ROLE_SEEDS.map((seed, index) => {
    const permissions = seed.permissions;
    const doc: CompanyRoleDocument = {
      _id: new ObjectId(),
      key: seed.key,
      name: seed.name,
      description: seed.description,
      color: seed.color,
      permissions,
      responsibilities: seed.responsibilities,
      scopes: seed.scopes,
      teamScopedProjects: seed.teamScopedProjects,
      teamScopedSeating: seed.teamScopedSeating,
      isSystem: true,
      displayOrder: seed.displayOrder ?? index,
    };
    return docToWorkspaceRole(doc);
  });
}

/** Ensures system roles in MongoDB include chat permissions from current seeds. */
export async function syncSystemRoleChatPermissions(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<void> {
  const col = db.collection<CompanyRoleDocument>(COLLECTIONS.companyRoles);
  for (const seed of SYSTEM_ROLE_SEEDS) {
    const chat = seed.permissions.chat;
    if (!chat) continue;
    await col.updateOne(
      { key: seed.key, isSystem: true },
      {
        $set: {
          "permissions.chat": chat,
          updatedAt: new Date(),
        },
      },
    );
  }
}

export async function ensureRolesSeed(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<void> {
  const col = db.collection<CompanyRoleDocument>(COLLECTIONS.companyRoles);
  const count = await col.countDocuments();
  if (count > 0) {
    await syncSystemRoleChatPermissions(db);
    invalidateServerRoleCache();
    return;
  }

  const docs: CompanyRoleDocument[] = SYSTEM_ROLE_SEEDS.map((seed, index) => ({
    _id: new ObjectId(),
    key: seed.key,
    name: seed.name,
    description: seed.description,
    color: seed.color,
    permissions: seed.permissions,
    responsibilities: seed.responsibilities,
    scopes: seed.scopes,
    teamScopedProjects: seed.teamScopedProjects,
    teamScopedSeating: seed.teamScopedSeating,
    isSystem: true,
    displayOrder: seed.displayOrder ?? index,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  try {
    await col.insertMany(docs);
  } catch (e) {
    if (!isDuplicateKeyError(e)) throw e;
  }
}

export async function listWorkspaceRoles(): Promise<WorkspaceRole[]> {
  const db = await getDb();
  if (!db) {
    if (memoryRoles.length === 0) {
      memoryRoles.push(...cloneMemoryRolesFromSeed());
    }
    return [...memoryRoles].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  await ensureColanModelIndexes(db);
  await ensureRolesSeed(db);
  await syncSystemRoleChatPermissions(db);
  invalidateServerRoleCache();

  const col = db.collection<CompanyRoleDocument>(COLLECTIONS.companyRoles);
  const docs = await col.find({}).sort({ displayOrder: 1, name: 1 }).toArray();
  return docs.map((doc) => docToWorkspaceRole(doc));
}

export async function getWorkspaceRoleByKey(
  key: string,
): Promise<WorkspaceRole | null> {
  const roles = await listWorkspaceRoles();
  return roles.find((r) => r.key === key) ?? null;
}

export function roleKeyFromName(name: string): string {
  const slug = teamSlugFromName(name.replace(/ team$/i, ""));
  return slug || "role";
}

export async function createWorkspaceRole(input: {
  name: string;
  description: string;
  color: string;
  permissions: Partial<ModulePermissionsMap>;
  responsibilities?: string[];
  scopes?: string[];
  teamScopedProjects?: boolean;
  teamScopedSeating?: boolean;
}): Promise<WorkspaceRole> {
  const name = input.name.trim();
  if (!name) throw new Error("Role name is required.");

  const key = roleKeyFromName(name);
  const permissions = normalizeModulePermissions(input.permissions);
  const hasAny = Object.values(permissions).some((p) => p.view || p.manage);
  if (!hasAny) throw new Error("Select at least one module permission.");

  const db = await getDb();

  if (!db) {
    if (memoryRoles.some((r) => r.key === key || r.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("A role with this name already exists.");
    }
    const doc: CompanyRoleDocument = {
      _id: new ObjectId(),
      key,
      name,
      description: input.description.trim(),
      color: input.color,
      permissions,
      responsibilities: input.responsibilities ?? [],
      scopes: input.scopes ?? [],
      teamScopedProjects: input.teamScopedProjects,
      teamScopedSeating: input.teamScopedSeating,
      isSystem: false,
      displayOrder: memoryRoles.length,
    };
    const row = docToWorkspaceRole(doc);
    memoryRoles.push(row);
    invalidateServerRoleCache();
    return row;
  }

  await ensureColanModelIndexes(db);
  await ensureRolesSeed(db);

  const col = db.collection<CompanyRoleDocument>(COLLECTIONS.companyRoles);
  const existing = await col.findOne({
    $or: [{ key }, { name }],
  });
  if (existing) throw new Error("A role with this name already exists.");

  const last = await col.find({}).sort({ displayOrder: -1 }).limit(1).toArray();
  const displayOrder = (last[0]?.displayOrder ?? -1) + 1;

  const doc: CompanyRoleDocument = {
    _id: new ObjectId(),
    key,
    name,
    description: input.description.trim(),
    color: input.color,
    permissions,
    responsibilities: input.responsibilities ?? [],
    scopes: input.scopes ?? [],
    teamScopedProjects: input.teamScopedProjects,
    teamScopedSeating: input.teamScopedSeating,
    isSystem: false,
    displayOrder,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    await col.insertOne(doc);
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      throw new Error("A role with this name already exists.");
    }
    throw e;
  }

  invalidateServerRoleCache();
  return docToWorkspaceRole(doc);
}

export async function updateWorkspaceRole(
  id: string,
  patch: {
    name?: string;
    description?: string;
    color?: string;
    permissions?: Partial<ModulePermissionsMap>;
    responsibilities?: string[];
    scopes?: string[];
    teamScopedProjects?: boolean;
    teamScopedSeating?: boolean;
  },
): Promise<WorkspaceRole | null> {
  const db = await getDb();

  if (!db) {
    const idx = memoryRoles.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const current = memoryRoles[idx];
    if (current.isSystem && patch.name && patch.name !== current.name) {
      throw new Error("System roles cannot be renamed.");
    }
    const permissions = patch.permissions
      ? normalizeModulePermissions(patch.permissions)
      : current.permissions;
    const nextDoc: CompanyRoleDocument = {
      _id: new ObjectId(id.length === 24 ? id : "0".repeat(24)),
      key: current.key,
      name: patch.name?.trim() ?? current.name,
      description: patch.description?.trim() ?? current.description,
      color: patch.color ?? current.color,
      permissions,
      responsibilities: patch.responsibilities ?? current.responsibilities,
      scopes: patch.scopes ?? current.scopes,
      teamScopedProjects: patch.teamScopedProjects ?? current.teamScopedProjects,
      teamScopedSeating: patch.teamScopedSeating ?? current.teamScopedSeating,
      isSystem: current.isSystem,
      displayOrder: current.displayOrder,
    };
    const row = docToWorkspaceRole(nextDoc);
    memoryRoles[idx] = row;
    invalidateServerRoleCache();
    return row;
  }

  if (!ObjectId.isValid(id)) return null;

  await ensureColanModelIndexes(db);
  const col = db.collection<CompanyRoleDocument>(COLLECTIONS.companyRoles);
  const existing = await col.findOne({ _id: new ObjectId(id) });
  if (!existing) return null;

  if (existing.isSystem && patch.name && patch.name.trim() !== existing.name) {
    throw new Error("System roles cannot be renamed.");
  }

  const updates: Partial<CompanyRoleDocument> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name.trim();
  if (patch.description !== undefined) updates.description = patch.description.trim();
  if (patch.color !== undefined) updates.color = patch.color;
  if (patch.permissions !== undefined) {
    updates.permissions = normalizeModulePermissions(patch.permissions);
  }
  if (patch.responsibilities !== undefined) updates.responsibilities = patch.responsibilities;
  if (patch.scopes !== undefined) updates.scopes = patch.scopes;
  if (patch.teamScopedProjects !== undefined) {
    updates.teamScopedProjects = patch.teamScopedProjects;
  }
  if (patch.teamScopedSeating !== undefined) {
    updates.teamScopedSeating = patch.teamScopedSeating;
  }

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: "after" },
  );

  invalidateServerRoleCache();
  return result ? docToWorkspaceRole(result) : null;
}

export async function deleteWorkspaceRole(id: string): Promise<boolean> {
  const db = await getDb();

  if (!db) {
    const idx = memoryRoles.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    if (memoryRoles[idx].isSystem) {
      throw new Error("System roles cannot be deleted.");
    }
    memoryRoles.splice(idx, 1);
    invalidateServerRoleCache();
    return true;
  }

  if (!ObjectId.isValid(id)) return false;

  const col = db.collection<CompanyRoleDocument>(COLLECTIONS.companyRoles);
  const existing = await col.findOne({ _id: new ObjectId(id) });
  if (!existing) return false;
  if (existing.isSystem) {
    throw new Error("System roles cannot be deleted.");
  }

  const users = await db
    .collection(COLLECTIONS.appUsers)
    .countDocuments({ appRole: existing.key });
  if (users > 0) {
    throw new Error(
      `Cannot delete — ${users} app user(s) still use this role. Reassign them first.`,
    );
  }

  await col.deleteOne({ _id: new ObjectId(id) });
  invalidateServerRoleCache();
  return true;
}

export { emptyModulePermissions };
