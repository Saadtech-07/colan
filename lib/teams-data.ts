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
