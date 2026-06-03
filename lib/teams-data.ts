import { MongoServerError, ObjectId, type Db } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { memoryStore } from "@/lib/memory-store";
import {
  DEFAULT_TEAM_NAMES,
  normalizeTeamName,
  teamSlugFromName,
} from "@/lib/team-utils";
import {
  COLLECTIONS,
  ensureColanModelIndexes,
  teamDocToDTO,
  type TeamDocument,
  type TeamDTO,
} from "@/models";

function isDuplicateKeyError(e: unknown): boolean {
  return e instanceof MongoServerError && (e.code === 11000 || e.code === 11001);
}

async function safeSeedInsert(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (e) {
    if (!isDuplicateKeyError(e)) throw e;
  }
}

export async function ensureTeamsSeed(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<void> {
  const col = db.collection<TeamDocument>(COLLECTIONS.teams);
  if ((await col.countDocuments()) > 0) return;

  const docs: TeamDocument[] = DEFAULT_TEAM_NAMES.map((name, index) => ({
    _id: new ObjectId(),
    name,
    slug: teamSlugFromName(name),
    displayOrder: index,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await safeSeedInsert(() => col.insertMany(docs));
}

export async function listTeams(): Promise<TeamDTO[]> {
  const db = await getDb();
  if (!db) {
    return [...memoryStore.teams].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  await ensureColanModelIndexes(db);
  await ensureTeamsSeed(db);

  const col = db.collection<TeamDocument>(COLLECTIONS.teams);
  const docs = await col.find({}).sort({ displayOrder: 1, name: 1 }).toArray();
  return docs.map(teamDocToDTO);
}

export async function listTeamNames(): Promise<string[]> {
  const teams = await listTeams();
  return teams.map((t) => t.name);
}

export async function assertTeamsExist(teamNames: string[]): Promise<string | null> {
  const known = new Set(await listTeamNames());
  const missing = teamNames.filter((t) => !known.has(t));
  if (missing.length === 0) return null;
  return `Unknown team(s): ${missing.join(", ")}. Create them under Project teams first.`;
}

export async function createTeam(rawName: string): Promise<TeamDTO> {
  const name = normalizeTeamName(rawName);
  if (!name) throw new Error("Team name is required.");

  const slug = teamSlugFromName(name);
  const db = await getDb();

  if (!db) {
    const existing = memoryStore.teams.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) throw new Error("A team with this name already exists.");

    const row: TeamDTO = {
      id: `team-${Date.now()}`,
      name,
      slug,
      displayOrder: memoryStore.teams.length,
    };
    memoryStore.teams.push(row);
    return row;
  }

  await ensureColanModelIndexes(db);
  await ensureTeamsSeed(db);

  const col = db.collection<TeamDocument>(COLLECTIONS.teams);
  const duplicate = await col.findOne({
    $or: [{ name }, { slug }],
  });
  if (duplicate) {
    throw new Error("A team with this name already exists.");
  }

  const last = await col
    .find({})
    .sort({ displayOrder: -1 })
    .limit(1)
    .toArray();
  const displayOrder = (last[0]?.displayOrder ?? -1) + 1;

  const doc: TeamDocument = {
    _id: new ObjectId(),
    name,
    slug,
    displayOrder,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    await col.insertOne(doc);
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      throw new Error("A team with this name already exists.");
    }
    throw e;
  }

  return teamDocToDTO(doc);
}

export async function getTeamById(id: string): Promise<TeamDTO | null> {
  const db = await getDb();
  if (!db) {
    return memoryStore.teams.find((team) => team.id === id) ?? null;
  }

  if (!ObjectId.isValid(id)) return null;

  await ensureColanModelIndexes(db);
  await ensureTeamsSeed(db);

  const doc = await db
    .collection<TeamDocument>(COLLECTIONS.teams)
    .findOne({ _id: new ObjectId(id) });
  return doc ? teamDocToDTO(doc) : null;
}

async function renameTeamReferences(
  db: Db,
  oldName: string,
  newName: string,
): Promise<void> {
  const now = new Date();
  await db.collection(COLLECTIONS.employees).updateMany(
    { team: oldName },
    { $set: { team: newName, updatedAt: now } },
  );
  await db.collection(COLLECTIONS.appUsers).updateMany(
    { team: oldName },
    { $set: { team: newName, updatedAt: now } },
  );
  await db.collection(COLLECTIONS.projects).updateMany({ teams: oldName }, [
    {
      $set: {
        teams: {
          $map: {
            input: "$teams",
            as: "team",
            in: {
              $cond: [{ $eq: ["$$team", oldName] }, newName, "$$team"],
            },
          },
        },
        updatedAt: now,
      },
    },
  ]);
}

function renameTeamReferencesInMemory(oldName: string, newName: string): void {
  for (const employee of memoryStore.employees) {
    if (employee.team === oldName) employee.team = newName;
  }
  for (const project of memoryStore.projects) {
    project.teams = project.teams.map((team) => (team === oldName ? newName : team));
  }
}

export async function updateTeam(id: string, rawName: string): Promise<TeamDTO | null> {
  const name = normalizeTeamName(rawName);
  if (!name) throw new Error("Team name is required.");

  const slug = teamSlugFromName(name);
  const db = await getDb();

  if (!db) {
    const current = memoryStore.teams.find((team) => team.id === id);
    if (!current) return null;

    const duplicate = memoryStore.teams.find(
      (team) => team.id !== id && team.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) throw new Error("A team with this name already exists.");

    const oldName = current.name;
    current.name = name;
    current.slug = slug;
    if (oldName !== name) {
      renameTeamReferencesInMemory(oldName, name);
    }
    return { ...current };
  }

  if (!ObjectId.isValid(id)) return null;

  await ensureColanModelIndexes(db);
  await ensureTeamsSeed(db);

  const col = db.collection<TeamDocument>(COLLECTIONS.teams);
  const current = await col.findOne({ _id: new ObjectId(id) });
  if (!current) return null;

  const duplicate = await col.findOne({
    _id: { $ne: current._id },
    $or: [{ name }, { slug }],
  });
  if (duplicate) {
    throw new Error("A team with this name already exists.");
  }

  const oldName = current.name;
  const updated = await col.findOneAndUpdate(
    { _id: current._id },
    { $set: { name, slug, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) return null;

  if (oldName !== name) {
    await renameTeamReferences(db, oldName, name);
  }

  return teamDocToDTO(updated);
}

async function countTeamDependencies(db: Db, teamName: string) {
  const [employees, projects, appUsers] = await Promise.all([
    db.collection(COLLECTIONS.employees).countDocuments({ team: teamName }),
    db.collection(COLLECTIONS.projects).countDocuments({ teams: teamName }),
    db.collection(COLLECTIONS.appUsers).countDocuments({ team: teamName }),
  ]);
  return { employees, projects, appUsers };
}

function countTeamDependenciesInMemory(teamName: string) {
  return {
    employees: memoryStore.employees.filter((employee) => employee.team === teamName).length,
    projects: memoryStore.projects.filter((project) => project.teams.includes(teamName)).length,
    appUsers: 0,
  };
}

export async function deleteTeam(id: string): Promise<boolean> {
  const db = await getDb();

  if (!db) {
    const index = memoryStore.teams.findIndex((team) => team.id === id);
    if (index === -1) return false;

    const teamName = memoryStore.teams[index]!.name;
    const deps = countTeamDependenciesInMemory(teamName);
    if (deps.employees > 0 || deps.projects > 0) {
      throw new Error(
        "Cannot delete a team that still has employees or projects assigned. Reassign them first.",
      );
    }

    memoryStore.teams.splice(index, 1);
    return true;
  }

  if (!ObjectId.isValid(id)) return false;

  await ensureColanModelIndexes(db);
  await ensureTeamsSeed(db);

  const col = db.collection<TeamDocument>(COLLECTIONS.teams);
  const current = await col.findOne({ _id: new ObjectId(id) });
  if (!current) return false;

  const deps = await countTeamDependencies(db, current.name);
  if (deps.employees > 0 || deps.projects > 0 || deps.appUsers > 0) {
    const parts: string[] = [];
    if (deps.employees > 0) parts.push(`${deps.employees} employee(s)`);
    if (deps.projects > 0) parts.push(`${deps.projects} project(s)`);
    if (deps.appUsers > 0) parts.push(`${deps.appUsers} app user(s)`);
    throw new Error(
      `Cannot delete this team while it still has ${parts.join(", ")} assigned. Reassign them first.`,
    );
  }

  const result = await col.deleteOne({ _id: current._id });
  return result.deletedCount === 1;
}
