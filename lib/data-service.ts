import {
  MongoBulkWriteError,
  MongoServerError,
  ObjectId,
  type Db,
} from "mongodb";
import { getDb } from "@/lib/mongodb";
import { memoryStore } from "@/lib/memory-store";
import {
  employeeSlugFromId,
  findEmployeeBySlugOrId,
} from "@/lib/employee-slug";
import { getProjectsForEmployee } from "@/lib/project-assignments";
import { assertProjectsMatchEmployeeTeam, filterProjectsByEmployeeTeam } from "@/lib/projects";
import { uniqueProjectSlug } from "@/lib/project-slug";
import type {
  Employee,
  EmployeeDetail,
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

  const { ensureTeamsSeed } = await import("@/lib/teams-data");
  const { ensureRolesSeed } = await import("@/lib/roles-data");
  await ensureAppUsersSeed(db);
  await ensureTeamsSeed(db);
  await ensureRolesSeed(db);

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
      ({ id: _id, memberIds: _m, teams, ...rest }) => {
        const teamEmps = employees.filter((e) => teams.includes(e.team));
        return {
          ...rest,
          teams,
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

export async function getEmployeeDetailBySlugOrId(
  slugOrId: string,
): Promise<EmployeeDetail | null> {
  const [employees, projects] = await Promise.all([
    listEmployees(),
    listProjects(),
  ]);
  const employee = findEmployeeBySlugOrId(employees, slugOrId);
  if (!employee) return null;
  const assignedProjects = filterProjectsByEmployeeTeam(
    employee,
    getProjectsForEmployee(employee.id, projects),
  );
  return {
    ...employee,
    slug: employeeSlugFromId(employee.employeeId),
    assignedProjects,
  };
}

export async function createEmployee(
  input: Omit<Employee, "id">,
): Promise<Employee> {
  const db = await getDb();
  if (!db) {
    const list = memoryStore.employees;
    const { isValidSeatId } = await import("@/lib/seating-layout");
    if (input.bayNumber && isValidSeatId(input.bayNumber)) {
      for (const e of list) {
        if (e.bayNumber === input.bayNumber) e.bayNumber = "";
      }
    }
    const id = `e-${Date.now()}`;
    const row: Employee = { ...input, id };
    list.push(row);
    return row;
  }
  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const { isValidSeatId } = await import("@/lib/seating-layout");
  if (input.bayNumber && isValidSeatId(input.bayNumber)) {
    await col.updateMany({ bayNumber: input.bayNumber }, { $set: { bayNumber: "" } });
  }
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

async function upsertEmployeeDirectory(
  db: Db,
  employeeRef: ObjectId,
  directory: Partial<EmployeeDirectoryInfo>,
): Promise<EmployeeDirectoryInfo | undefined> {
  const det = db.collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails);
  const existing = await det.findOne({ employeeRef });
  const merged: EmployeeDetailsDocument = {
    _id: existing?._id ?? new ObjectId(),
    employeeRef,
    workEmail:
      directory.workEmail !== undefined
        ? directory.workEmail || undefined
        : existing?.workEmail,
    phone:
      directory.phone !== undefined ? directory.phone || undefined : existing?.phone,
    location:
      directory.location !== undefined
        ? directory.location || undefined
        : existing?.location,
    joinedDate:
      directory.joinedDate !== undefined
        ? directory.joinedDate || undefined
        : existing?.joinedDate,
    notes:
      directory.notes !== undefined ? directory.notes || undefined : existing?.notes,
    updatedAt: new Date(),
    createdAt: existing?.createdAt ?? new Date(),
  };
  await det.updateOne(
    { employeeRef },
    { $set: merged },
    { upsert: true },
  );
  return detailsToDirectory(employeeDetailsDocToDTO(merged));
}

export async function updateEmployee(
  id: string,
  patch: Partial<Omit<Employee, "id">> & { directory?: Partial<EmployeeDirectoryInfo> },
): Promise<Employee> {
  const db = await getDb();
  const normalizedId = String(id).trim();
  if (!normalizedId || normalizedId === "undefined") {
    throw new Error("Invalid employee id");
  }
  const { isValidSeatId } = await import("@/lib/seating-layout");
  const directoryPatch = patch.directory;
  const employeePatch = { ...patch };
  delete (employeePatch as { directory?: unknown }).directory;

  if (patch.bayNumber !== undefined) {
    const bay = patch.bayNumber.trim();
    if (bay && !isValidSeatId(bay)) {
      throw new Error(
        `Invalid seat "${bay}". Choose a seat from the floor plan (e.g. A1, D3).`,
      );
    }
    if (db) {
      if (bay) {
        await assignEmployeeToBay(bay, normalizedId);
      } else {
        await ensureMongoSeed(db);
        await db
          .collection<EmployeeDocument>(COLLECTIONS.employees)
          .updateOne({ _id: new ObjectId(normalizedId) }, { $set: { bayNumber: "" } });
      }
    }
    employeePatch.bayNumber = bay;
  }

  if (!db) {
    const list = memoryStore.employees;
    const idx = list.findIndex((e) => e.id === normalizedId);
    if (idx < 0) throw new Error("Employee not found");
    const current = list[idx];
    if (employeePatch.bayNumber !== undefined && employeePatch.bayNumber) {
      for (const e of list) {
        if (e.bayNumber === employeePatch.bayNumber) e.bayNumber = "";
      }
    }
    const nextDirectory = directoryPatch
      ? { ...current.directory, ...directoryPatch }
      : current.directory;
    const next: Employee = {
      ...current,
      ...(employeePatch.employeeId !== undefined
        ? { employeeId: employeePatch.employeeId }
        : {}),
      ...(employeePatch.name !== undefined ? { name: employeePatch.name } : {}),
      ...(employeePatch.team !== undefined ? { team: employeePatch.team } : {}),
      ...(employeePatch.role !== undefined ? { role: employeePatch.role } : {}),
      ...(employeePatch.bayNumber !== undefined
        ? { bayNumber: employeePatch.bayNumber }
        : {}),
      ...(employeePatch.imageUrl !== undefined
        ? { imageUrl: employeePatch.imageUrl }
        : {}),
      ...(directoryPatch ? { directory: nextDirectory } : {}),
    };
    list[idx] = next;
    return { ...next };
  }

  if (!ObjectId.isValid(normalizedId)) {
    const list = memoryStore.employees;
    const idx = list.findIndex((e) => e.id === normalizedId);
    if (idx < 0) throw new Error("Invalid employee id");
    const current = list[idx];
    const nextDirectory = directoryPatch
      ? { ...current.directory, ...directoryPatch }
      : current.directory;
    const next: Employee = {
      ...current,
      ...(employeePatch.employeeId !== undefined
        ? { employeeId: employeePatch.employeeId }
        : {}),
      ...(employeePatch.name !== undefined ? { name: employeePatch.name } : {}),
      ...(employeePatch.team !== undefined ? { team: employeePatch.team } : {}),
      ...(employeePatch.role !== undefined ? { role: employeePatch.role } : {}),
      ...(employeePatch.bayNumber !== undefined
        ? { bayNumber: employeePatch.bayNumber }
        : {}),
      ...(employeePatch.imageUrl !== undefined
        ? { imageUrl: employeePatch.imageUrl }
        : {}),
      ...(directoryPatch ? { directory: nextDirectory } : {}),
    };
    list[idx] = next;
    return { ...next };
  }

  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const oid = new ObjectId(normalizedId);
  const updates: Partial<EmployeeDocument> = { updatedAt: new Date() };
  if (employeePatch.employeeId !== undefined) updates.employeeId = employeePatch.employeeId;
  if (employeePatch.name !== undefined) updates.name = employeePatch.name;
  if (employeePatch.team !== undefined) updates.team = employeePatch.team;
  if (employeePatch.role !== undefined) updates.role = employeePatch.role;
  if (employeePatch.imageUrl !== undefined) updates.imageUrl = employeePatch.imageUrl;
  if (patch.bayNumber !== undefined && !patch.bayNumber.trim()) {
    updates.bayNumber = "";
  }

  if (Object.keys(updates).length > 1) {
    await col.updateOne({ _id: oid }, { $set: updates });
  }

  if (directoryPatch) {
    await upsertEmployeeDirectory(db, oid, directoryPatch);
  }

  const row = await col.findOne({ _id: oid });
  if (!row) throw new Error("Employee not found");
  const base = employeeDocToDTO(row);
  const detCol = db.collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails);
  const detailDoc = await detCol.findOne({ employeeRef: oid });
  return detailDoc
    ? { ...base, directory: detailsToDirectory(employeeDetailsDocToDTO(detailDoc)) }
    : base;
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
  const { isValidSeatId } = await import("@/lib/seating-layout");
  if (!isValidSeatId(bayId)) {
    throw new Error(`Invalid seat "${bayId}". Use a seat from the office floor plan (e.g. A1, B14).`);
  }
  const db = await getDb();
  if (!db) {
    const list = memoryStore.employees;
    for (const e of list) {
      if (e.bayNumber === bayId) e.bayNumber = "";
    }
    if (employeeId) {
      const emp = list.find((e) => e.id === employeeId);
      if (emp) {
        emp.bayNumber = bayId;
      }
      for (const e of list) {
        if (e.id !== employeeId && e.bayNumber === bayId) e.bayNumber = "";
      }
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
    await col.updateMany(
      { _id: new ObjectId(employeeId) },
      { $set: { bayNumber: bayId } },
    );
    await col.updateMany(
      { bayNumber: bayId, _id: { $ne: new ObjectId(employeeId) } },
      { $set: { bayNumber: "" } },
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
    teams: input.teams,
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
      | "teams"
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
 * Set which projects an employee works on by syncing `memberIds` on squad projects.
 * Cross-team assignment is rejected. Only projects where `canModify(project)` is updated.
 */
export async function setEmployeeProjects(
  employeeId: string,
  projectIds: string[],
  canModify: (project: Project) => boolean,
  employeeTeam: Employee["team"],
): Promise<Project[]> {
  const normalizedId = String(employeeId).trim();
  if (!normalizedId) throw new Error("Invalid employee id");

  const projects = await listProjects();
  assertProjectsMatchEmployeeTeam(employeeTeam, projectIds, projects);

  for (const projectId of projectIds) {
    const project = projects.find((p) => p.id === projectId);
    if (project && !canModify(project)) {
      throw new Error(`You do not have permission to assign "${project.name}".`);
    }
  }

  const targetIds = new Set(projectIds);
  const teamProjects = filterProjectsByEmployeeTeam(
    { team: employeeTeam },
    projects,
  );

  for (const project of teamProjects) {
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

export async function updateGalleryItem(
  id: string,
  patch: Partial<Omit<GalleryImage, "id">>,
): Promise<GalleryImage> {
  const normalizedId = String(id).trim();
  if (!normalizedId) throw new Error("Gallery item not found");

  const db = await getDb();
  if (!db) {
    const idx = memoryStore.gallery.findIndex((item) => item.id === normalizedId);
    if (idx < 0) throw new Error("Gallery item not found");
    const current = memoryStore.gallery[idx];
    const next: GalleryImage = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.url !== undefined ? { url: patch.url } : {}),
      ...(patch.caption !== undefined ? { caption: patch.caption } : {}),
      ...(patch.uploadedAt !== undefined ? { uploadedAt: patch.uploadedAt } : {}),
    };
    memoryStore.gallery[idx] = next;
    return { ...next };
  }

  await ensureMongoSeed(db);
  if (!ObjectId.isValid(normalizedId)) throw new Error("Gallery item not found");

  const col = db.collection<GalleryImageDocument>(COLLECTIONS.gallery);
  const updates: Partial<GalleryImageDocument> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.url !== undefined) updates.url = patch.url;
  if (patch.caption !== undefined) updates.caption = patch.caption;
  if (patch.uploadedAt !== undefined) updates.uploadedAt = patch.uploadedAt;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(normalizedId) },
    { $set: updates },
    { returnDocument: "after" },
  );
  if (!result) throw new Error("Gallery item not found");
  return galleryImageDocToDTO(result);
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const normalizedId = String(id).trim();
  if (!normalizedId) throw new Error("Gallery item not found");

  const db = await getDb();
  if (!db) {
    const idx = memoryStore.gallery.findIndex((item) => item.id === normalizedId);
    if (idx < 0) throw new Error("Gallery item not found");
    memoryStore.gallery.splice(idx, 1);
    return;
  }

  await ensureMongoSeed(db);
  if (!ObjectId.isValid(normalizedId)) throw new Error("Gallery item not found");

  const result = await db
    .collection<GalleryImageDocument>(COLLECTIONS.gallery)
    .deleteOne({ _id: new ObjectId(normalizedId) });

  if (result.deletedCount === 0) throw new Error("Gallery item not found");
}
