import {
  MongoBulkWriteError,
  MongoServerError,
  ObjectId,
  type Db,
} from "mongodb";
import { getDb } from "@/lib/mongodb";
import { memoryStore } from "@/lib/memory-store";
import { uniqueProjectSlug } from "@/lib/project-slug";
import type {
  Employee,
  EmployeeDirectoryInfo,
  GalleryImage,
  Project,
  ProjectDetail,
} from "@/types";
import {
  COLLECTIONS,
  ensureColanModelIndexes,
  employeeDetailsDocToDTO,
  employeeDocToDTO,
  employeeInputToDocFields,
  galleryImageDocToDTO,
  projectDocToDTO,
  type EmployeeDetailsDocument,
  type EmployeeDocument,
  type GalleryImageDocument,
  type ProjectDocument,
} from "@/models";
import {
  MOCK_EMPLOYEES,
  MOCK_GALLERY,
  MOCK_PROJECTS,
} from "@/lib/mock-data";
import { ensureAppUsersSeed } from "@/lib/app-users";

function resolveMembers(memberIds: string[], all: Employee[]): Employee[] {
  if (memberIds.length === 0) return [];
  const byId = new Map(all.map((e) => [e.id, e]));
  const out: Employee[] = [];
  for (const id of memberIds) {
    const row = byId.get(id);
    if (row) out.push(row);
  }
  return out;
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

function isDuplicateKeyError(e: unknown): boolean {
  if (e instanceof MongoBulkWriteError) {
    if (e.code === 11000 || e.code === 11001) return true;
    const we = e.writeErrors;
    if (Array.isArray(we)) {
      return we.some((w) => w.code === 11000 || w.code === 11001);
    }
    if (we && typeof we === "object" && "code" in we) {
      const code = (we as { code?: number }).code;
      return code === 11000 || code === 11001;
    }
    return false;
  }
  if (e instanceof MongoServerError)
    return e.code === 11000 || e.code === 11001;
  return false;
}

async function safeSeedInsert(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (e) {
    if (!isDuplicateKeyError(e)) throw e;
  }
}

async function repairProjectMemberIds(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
) {
  const em = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const pr = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const ids = await em.find({}, { projection: { _id: 1 } }).toArray();
  const valid = new Set(ids.map((d) => d._id.toHexString()));
  const projects = await pr.find({ memberIds: { $exists: true } }).toArray();
  for (const p of projects) {
    const raw = Array.isArray(p.memberIds) ? p.memberIds : [];
    const next = raw.filter((id) => typeof id === "string" && valid.has(id));
    if (next.length !== raw.length) {
      await pr.updateOne({ _id: p._id }, { $set: { memberIds: next, updatedAt: new Date() } });
    }
  }
}

async function ensureMongoSeed(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const pr = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const em = db.collection<EmployeeDocument>(COLLECTIONS.employees);

  await ensureAppUsersSeed(db);

  if ((await em.countDocuments()) === 0) {
    await safeSeedInsert(() =>
      em.insertMany(
        MOCK_EMPLOYEES.map(({ id: _id, ...rest }) => ({
          ...rest,
          _id: new ObjectId(),
        })) as EmployeeDocument[],
      ),
    );
  }

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
    await safeSeedInsert(() => pr.insertMany(docs));
  }

  const ga = db.collection<GalleryImageDocument>(COLLECTIONS.gallery);
  if ((await ga.countDocuments()) === 0) {
    await safeSeedInsert(() =>
      ga.insertMany(
        MOCK_GALLERY.map(({ id: _id, ...rest }) => ({
          ...rest,
          _id: new ObjectId(),
        })) as GalleryImageDocument[],
      ),
    );
  }

  await backfillProjectSlugs(db);
  await repairProjectMemberIds(db);

  const det = db.collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails);
  if ((await det.countDocuments()) === 0 && (await em.countDocuments()) > 0) {
    const everyone = await em.find({}).toArray();
    await safeSeedInsert(() =>
      det.insertMany(
        everyone.map((emp, i) => ({
          _id: new ObjectId(),
          employeeRef: emp._id,
          workEmail: `${emp.employeeId.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@colan.io`,
          phone: `+1-555-${String(1000 + (i % 9000)).padStart(4, "0")}`,
          location: ["Chennai HQ", "Remote", "Singapore"][i % 3],
          joinedDate: `202${3 + (i % 3)}-${String(((i * 3) % 9) + 1).padStart(2, "0")}-15`,
          notes: "Seeded employee_details row for Atlas demo.",
          updatedAt: new Date(),
        })),
      ),
    );
  }

  await ensureColanModelIndexes(db);
}

function detailsToDirectory(
  dto: ReturnType<typeof employeeDetailsDocToDTO>,
): EmployeeDirectoryInfo {
  return {
    workEmail: dto.workEmail,
    phone: dto.phone,
    location: dto.location,
    joinedDate: dto.joinedDate,
    notes: dto.notes,
  };
}

export async function listEmployees(): Promise<Employee[]> {
  const db = await getDb();
  if (!db) return memoryStore.employees.map((e) => ({ ...e }));
  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const rows = await col.find({}).sort({ name: 1 }).toArray();
  const detCol = db.collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails);
  const refs = rows.map((r) => r._id);
  const detailRows =
    refs.length === 0
      ? []
      : await detCol.find({ employeeRef: { $in: refs } }).toArray();
  const byRef = new Map(
    detailRows.map((d) => [d.employeeRef.toHexString(), d]),
  );
  return rows.map((d) => {
    const base = employeeDocToDTO(d);
    const doc = byRef.get(base.id);
    if (!doc) return base;
    return { ...base, directory: detailsToDirectory(employeeDetailsDocToDTO(doc)) };
  });
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
  const det = db.collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails);
  const detailDoc: EmployeeDetailsDocument = {
    _id: new ObjectId(),
    employeeRef: _id,
    workEmail: `${input.employeeId.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@colan.io`,
    notes: "Created with this employee record.",
    updatedAt: new Date(),
  };
  await safeSeedInsert(() => det.insertOne(detailDoc));
  return {
    ...employeeDocToDTO(doc),
    directory: detailsToDirectory(employeeDetailsDocToDTO(detailDoc)),
  };
}

export async function updateEmployee(
  id: string,
  patch: Partial<Omit<Employee, "id">>,
): Promise<Employee> {
  const db = await getDb();
  const normalizedId = String(id).trim();
  if (!normalizedId || normalizedId === "undefined") {
    throw new Error("Invalid employee id");
  }
  if (!db) {
    const list = memoryStore.employees;
    const idx = list.findIndex((e) => e.id === normalizedId);
    if (idx < 0) throw new Error("Employee not found");
    const current = list[idx];
    const next: Employee = {
      ...current,
      ...(patch.employeeId !== undefined ? { employeeId: patch.employeeId } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.team !== undefined ? { team: patch.team } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.bayNumber !== undefined ? { bayNumber: patch.bayNumber } : {}),
      ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
    };
    list[idx] = next;
    return { ...next };
  }
  // If an id isn't a valid ObjectId but we still have a DB (e.g. dev UI sent a memory id),
  // fall back to the in-memory store so the UI can edit items created in-memory.
  if (!ObjectId.isValid(normalizedId)) {
    const list = memoryStore.employees;
    const idx = list.findIndex((e) => e.id === normalizedId);
    if (idx < 0) throw new Error("Invalid employee id");
    const current = list[idx];
    const next: Employee = {
      ...current,
      ...(patch.employeeId !== undefined ? { employeeId: patch.employeeId } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.team !== undefined ? { team: patch.team } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.bayNumber !== undefined ? { bayNumber: patch.bayNumber } : {}),
      ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
    };
    list[idx] = next;
    return { ...next };
  }
  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const updates: Partial<EmployeeDocument> = { updatedAt: new Date() };
  if (patch.employeeId !== undefined) updates.employeeId = patch.employeeId;
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.team !== undefined) updates.team = patch.team;
  if (patch.role !== undefined) updates.role = patch.role;
  if (patch.bayNumber !== undefined) updates.bayNumber = patch.bayNumber;
  if (patch.imageUrl !== undefined) updates.imageUrl = patch.imageUrl;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(normalizedId) },
    { $set: updates },
    { returnDocument: "after" },
  );
  if (!result) throw new Error("Employee not found");
  return employeeDocToDTO(result);
}

export async function deleteEmployee(id: string): Promise<void> {
  const db = await getDb();
  const normalizedId = String(id).trim();
  if (!normalizedId || normalizedId === "undefined") {
    throw new Error("Invalid employee id");
  }
  if (!db) {
    const list = memoryStore.employees;
    const idx = list.findIndex((e) => e.id === normalizedId);
    if (idx >= 0) list.splice(idx, 1);
    return;
  }

  // If id is not a valid ObjectId, try the in-memory store as a fallback.
  if (!ObjectId.isValid(normalizedId)) {
    const list = memoryStore.employees;
    const idx = list.findIndex((e) => e.id === normalizedId);
    if (idx >= 0) {
      list.splice(idx, 1);
      return;
    }
    throw new Error("Invalid employee id");
  }

  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  await col.deleteOne({ _id: new ObjectId(normalizedId) });
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

/**
 * Set which projects an employee works on by syncing `memberIds` on each project.
 * Only projects where `canModify(project)` is true are updated.
 */
export async function setEmployeeProjects(
  employeeId: string,
  projectIds: string[],
  canModify: (project: Project) => boolean,
): Promise<Project[]> {
  const normalizedId = String(employeeId).trim();
  if (!normalizedId) throw new Error("Invalid employee id");

  const projects = await listProjects();
  const targetIds = new Set(projectIds);

  for (const project of projects) {
    if (!canModify(project)) continue;
    const hasMember = project.memberIds.includes(normalizedId);
    const shouldHave = targetIds.has(project.id);
    if (hasMember === shouldHave) continue;

    const memberIds = shouldHave
      ? [...project.memberIds, normalizedId]
      : project.memberIds.filter((id) => id !== normalizedId);

    await updateProjectBySlug(project.slug, { memberIds });
  }

  return listProjects();
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
