import { ObjectId, type Db } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { memoryStore } from "@/lib/memory-store";
import { uniqueProjectSlug } from "@/lib/project-slug";
import type { Employee, GalleryImage, Project, ProjectDetail } from "@/types";
import {
  COLLECTIONS,
  ensureColanModelIndexes,
  employeeDocToDTO,
  employeeInputToDocFields,
  galleryImageDocToDTO,
  projectDocToDTO,
  type EmployeeDocument,
  type GalleryImageDocument,
  type ProjectDocument,
} from "@/models";
import {
  MOCK_EMPLOYEES,
  MOCK_GALLERY,
  MOCK_PROJECTS,
} from "@/lib/mock-data";

function resolveMembers(memberIds: string[], all: Employee[]): Employee[] {
  if (memberIds.length === 0) {
    return [];
  }
  const set = new Set(memberIds);
  return all.filter((e) => set.has(e.id));
}

function toDetail(project: Project, allEmployees: Employee[]): ProjectDetail {
  return {
    ...project,
    members: resolveMembers(project.memberIds, allEmployees),
  };
}

/** Assign unique slugs before the unique index on `slug` is created. */
async function backfillProjectSlugs(db: Db) {
  const pr = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const needsSlug = await pr
    .find({
      $or: [
        { slug: { $exists: false } },
        { slug: "" },
        { slug: { $type: 10 } },
      ],
    })
    .toArray();

  if (needsSlug.length === 0) return;

  const existing = await pr.find({}, { projection: { slug: 1 } }).toArray();
  const taken = existing
    .map((d) => d.slug)
    .filter((s): s is string => typeof s === "string" && s.length > 0);

  for (const doc of needsSlug) {
    const slug = uniqueProjectSlug(doc.name || "project", taken);
    taken.push(slug);
    await pr.updateOne(
      { _id: doc._id },
      {
        $set: {
          slug,
          memberIds: Array.isArray(doc.memberIds) ? doc.memberIds : [],
        },
      },
    );
  }
}

async function ensureMongoSeed(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const em = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  if ((await em.countDocuments()) === 0) {
    await em.insertMany(
      MOCK_EMPLOYEES.map(({ id: _id, ...rest }) => ({
        ...rest,
        _id: new ObjectId(),
      })) as EmployeeDocument[],
    );
  }

  const pr = db.collection<ProjectDocument>(COLLECTIONS.projects);
  if ((await pr.countDocuments()) === 0) {
    const employees = await em.find({}).toArray();
    const docs: ProjectDocument[] = MOCK_PROJECTS.map(
      ({ id: _id, memberIds: _m, ...rest }) => {
        const teamEmps = employees.filter((e) => e.team === rest.team);
        return {
          ...rest,
          memberIds: teamEmps.slice(0, 2).map((e) => e._id.toHexString()),
          _id: new ObjectId(),
        };
      },
    );
    await pr.insertMany(docs);
  }

  await backfillProjectSlugs(db);

  try {
    await pr.dropIndex("slug_1");
  } catch {
    /* index may not exist yet */
  }

  await ensureColanModelIndexes(db);

  const ga = db.collection<GalleryImageDocument>(COLLECTIONS.gallery);
  if ((await ga.countDocuments()) === 0) {
    await ga.insertMany(
      MOCK_GALLERY.map(({ id: _id, ...rest }) => ({
        ...rest,
        _id: new ObjectId(),
      })) as GalleryImageDocument[],
    );
  }
}

export async function listEmployees(): Promise<Employee[]> {
  const db = await getDb();
  if (!db) return memoryStore.employees.map((e) => ({ ...e }));
  await ensureMongoSeed(db);
  const rows = await db
    .collection<EmployeeDocument>(COLLECTIONS.employees)
    .find({})
    .sort({ name: 1 })
    .toArray();
  return rows.map((d) => employeeDocToDTO(d));
}

export async function createEmployee(
  input: Omit<Employee, "id">,
): Promise<Employee> {
  const db = await getDb();
  if (!db) {
    const list = memoryStore.employees;
    for (const e of list) {
      if (e.bayNumber === input.bayNumber) e.bayNumber = "";
    }
    const id = `e-${Date.now()}`;
    const row: Employee = { ...input, id };
    list.push(row);
    return row;
  }
  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  await col.updateMany({ bayNumber: input.bayNumber }, { $set: { bayNumber: "" } });
  const _id = new ObjectId();
  const doc: EmployeeDocument = { _id, ...employeeInputToDocFields(input) };
  await col.insertOne(doc);
  return employeeDocToDTO(doc);
}

export async function assignEmployeeToBay(
  bayId: string,
  employeeId: string | null,
): Promise<Employee[]> {
  const db = await getDb();
  if (!db) {
    const list = memoryStore.employees;
    for (const e of list) {
      if (e.bayNumber === bayId) e.bayNumber = "";
    }
    if (employeeId) {
      const emp = list.find((e) => e.id === employeeId);
      if (emp) emp.bayNumber = bayId;
    }
    return list.map((e) => ({ ...e }));
  }
  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  await col.updateMany({ bayNumber: bayId }, { $set: { bayNumber: "" } });
  if (employeeId) {
    if (!ObjectId.isValid(employeeId)) {
      throw new Error("Invalid employee id");
    }
    await col.updateOne(
      { _id: new ObjectId(employeeId) },
      { $set: { bayNumber: bayId } },
    );
  }
  return listEmployees();
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  if (!db) return memoryStore.projects.map((p) => ({ ...p }));
  await ensureMongoSeed(db);
  const rows = await db
    .collection<ProjectDocument>(COLLECTIONS.projects)
    .find({})
    .sort({ assignedDate: -1 })
    .toArray();
  return rows.map((d) => projectDocToDTO(d));
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const db = await getDb();
  if (!db) {
    return memoryStore.projects.find((p) => p.slug === slug) ?? null;
  }
  await ensureMongoSeed(db);
  const doc = await db
    .collection<ProjectDocument>(COLLECTIONS.projects)
    .findOne({ slug });
  return doc ? projectDocToDTO(doc) : null;
}

export async function getProjectDetailBySlug(
  slug: string,
): Promise<ProjectDetail | null> {
  const project = await getProjectBySlug(slug);
  if (!project) return null;
  const employees = await listEmployees();
  return toDetail(project, employees);
}

export async function createProject(
  input: Omit<Project, "id" | "slug"> & { slug?: string },
): Promise<Project> {
  const memberIds = input.memberIds ?? [];
  const db = await getDb();
  if (!db) {
    const existing = memoryStore.projects.map((p) => p.slug);
    const slug =
      input.slug ?? uniqueProjectSlug(input.name, existing);
    const row: Project = {
      ...input,
      memberIds,
      slug,
      id: `p-${Date.now()}`,
    };
    memoryStore.projects.push(row);
    return row;
  }
  await ensureMongoSeed(db);
  const col = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const existing = await col.find({}, { projection: { slug: 1 } }).toArray();
  const slug =
    input.slug ??
    uniqueProjectSlug(
      input.name,
      existing.map((d) => d.slug),
    );
  const _id = new ObjectId();
  const doc: ProjectDocument = {
    _id,
    slug,
    name: input.name,
    team: input.team,
    assignedDate: input.assignedDate,
    lastDate: input.lastDate,
    status: input.status,
    description: input.description,
    memberIds,
    updatedAt: new Date(),
  };
  await col.insertOne(doc);
  return projectDocToDTO(doc);
}

export async function updateProjectBySlug(
  slug: string,
  patch: Partial<
    Pick<
      Project,
      | "name"
      | "team"
      | "assignedDate"
      | "lastDate"
      | "status"
      | "description"
      | "memberIds"
    >
  >,
): Promise<Project | null> {
  const db = await getDb();
  if (!db) {
    const idx = memoryStore.projects.findIndex((p) => p.slug === slug);
    if (idx < 0) return null;
    const current = memoryStore.projects[idx];
    const next: Project = {
      ...current,
      ...patch,
      memberIds: patch.memberIds ?? current.memberIds,
    };
    memoryStore.projects[idx] = next;
    return next;
  }
  await ensureMongoSeed(db);
  const col = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const result = await col.findOneAndUpdate(
    { slug },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return result ? projectDocToDTO(result) : null;
}

export async function listGallery(): Promise<GalleryImage[]> {
  const db = await getDb();
  if (!db) return memoryStore.gallery.map((g) => ({ ...g }));
  await ensureMongoSeed(db);
  const rows = await db
    .collection<GalleryImageDocument>(COLLECTIONS.gallery)
    .find({})
    .sort({ uploadedAt: -1 })
    .toArray();
  return rows.map((d) => galleryImageDocToDTO(d));
}

export async function createGalleryItem(
  input: Omit<GalleryImage, "id">,
): Promise<GalleryImage> {
  const db = await getDb();
  if (!db) {
    const row: GalleryImage = { ...input, id: `g-${Date.now()}` };
    memoryStore.gallery.unshift(row);
    return row;
  }
  await ensureMongoSeed(db);
  const _id = new ObjectId();
  const doc: GalleryImageDocument = { _id, ...input };
  await db.collection<GalleryImageDocument>(COLLECTIONS.gallery).insertOne(doc);
  return galleryImageDocToDTO(doc);
}
