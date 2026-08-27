import {
  MongoBulkWriteError,
  MongoServerError,
  ObjectId,
  type Db,
} from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  allowInMemoryFallback,
  isDemoSeedEnabled,
  requireDb,
} from "@/lib/data-backend";
import { memoryStore } from "@/lib/memory-store";
import {
  employeeSlugFromId,
  findEmployeeBySlugOrId,
} from "@/lib/employee-slug";
import { getProjectsForEmployee } from "@/lib/project-assignments";
import { assertProjectsMatchEmployeeTeam, filterProjectsByEmployeeTeam } from "@/lib/projects";
import { resolveProjectTeamsFromDoc } from "@/lib/project-team-resolve";
import { mergeProjectTeamNames } from "@/lib/project-teams";
import { listTeams } from "@/lib/teams-data";
import { uniqueProjectSlug } from "@/lib/project-slug";
import type {
  Employee,
  EmployeeDetail,
  EmployeeDirectoryInfo,
  GalleryImage,
  Project,
  ProjectDetail,
  TeamName,
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
  type AppUserDocument,
} from "@/models";
import { ensureAppUsersSeed, getAppUserPublicById } from "@/lib/app-users";
import { collectLinkedEmployeeIds } from "@/lib/employee-app-user-link";
import { isProjectManagerAppRole } from "@/lib/project-managers";
import {
  MOCK_EMPLOYEES,
  MOCK_GALLERY,
  MOCK_PROJECTS,
} from "@/lib/mock-data";

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

declare global {
  // eslint-disable-next-line no-var
  var __colanMongoSeedPromise: Map<string, Promise<void>> | undefined;
}

function mongoSeedCacheKey(db: Db): string {
  return db.databaseName;
}

/** Copy legacy `team` into `teams` and persist normalized squad lists. */
async function backfillProjectTeams(db: Db) {
  const col = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const needsBackfill = await col.countDocuments({
    $or: [
      { team: { $exists: true, $type: "string", $ne: "" } },
      { teams: { $exists: false } },
      { teams: { $size: 0 } },
    ],
  });
  if (needsBackfill === 0) return;

  const docs = await col.find({}).toArray();
  const now = new Date();

  const catalog = await listTeams();

  for (const doc of docs) {
    const teams = resolveProjectTeamsFromDoc(doc, catalog);
    const rawTeams = doc.teams as TeamName[] | TeamName | undefined;
    const stored = Array.isArray(rawTeams)
      ? rawTeams.map((t) => String(t).trim()).filter(Boolean).sort().join("\0")
      : typeof rawTeams === "string"
        ? rawTeams.trim()
        : "";
    const nextKey = [...teams].sort().join("\0");
    if (stored === nextKey) continue;

    await col.updateOne(
      { _id: doc._id },
      teams.length > 0
        ? { $set: { teams, updatedAt: now }, $unset: { team: "" } }
        : { $set: { teams, updatedAt: now } },
    );
  }
}

/** Ensure metadata fields exist on legacy project documents. */
async function backfillProjectMetadata(db: Db) {
  const col = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const now = new Date();

  await col.updateMany(
    { clientName: { $exists: false } },
    { $set: { clientName: "", updatedAt: now } },
  );

  await col.updateMany(
    { projectManagerId: { $exists: false } },
    { $set: { projectManagerId: "", updatedAt: now } },
  );

  await col.updateMany(
    { description: { $exists: false } },
    { $set: { description: "", updatedAt: now } },
  );
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

async function backfillEmployeeGender(db: Db) {
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  await col.updateMany(
    { gender: { $exists: false } },
    { $set: { gender: "male", updatedAt: new Date() } },
  );
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

async function ensureMongoSeedWork(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const pr = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const em = db.collection<EmployeeDocument>(COLLECTIONS.employees);

  const { ensureTeamsSeed } = await import("@/lib/teams-data");
  const { ensureRolesSeed } = await import("@/lib/roles-data");
  const { listFloorPlans } = await import("@/lib/floor-plans");
  await ensureAppUsersSeed(db);
  await ensureTeamsSeed(db);
  await ensureRolesSeed(db);
  await listFloorPlans();

  if (isDemoSeedEnabled() && (await em.countDocuments()) === 0) {
    await safeSeedInsert(() =>
      em.insertMany(
        MOCK_EMPLOYEES.map(({ id: _id, ...rest }) => ({
          ...rest,
          _id: new ObjectId(),
        })) as EmployeeDocument[],
      ),
    );
  }

  if (isDemoSeedEnabled() && (await pr.countDocuments()) === 0) {
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
  if (isDemoSeedEnabled() && (await ga.countDocuments()) === 0) {
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
  await backfillProjectTeams(db);
  await backfillProjectMetadata(db);
  await repairProjectMemberIds(db);
  await backfillEmployeeGender(db);

  const det = db.collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails);
  if (
    isDemoSeedEnabled() &&
    (await det.countDocuments()) === 0 &&
    (await em.countDocuments()) > 0
  ) {
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
  await purgeOrphanEmployeeRecords(db);
}

/** Seed, backfill, and index setup — once per database per server process. */
export async function ensureMongoSeed(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const key = mongoSeedCacheKey(db);
  if (!globalThis.__colanMongoSeedPromise) {
    globalThis.__colanMongoSeedPromise = new Map();
  }
  let pending = globalThis.__colanMongoSeedPromise.get(key);
  if (!pending) {
    pending = ensureMongoSeedWork(db);
    globalThis.__colanMongoSeedPromise.set(key, pending);
  }
  return pending;
}

function detailsToDirectory(
  dto: ReturnType<typeof employeeDetailsDocToDTO>,
): EmployeeDirectoryInfo {
  return {
    workEmail: dto.workEmail,
    phone: dto.phone,
    location: dto.location,
    fullAddress: dto.fullAddress,
    currentAddress: dto.currentAddress,
    permanentAddress: dto.permanentAddress,
    joinedDate: dto.joinedDate,
    notes: dto.notes,
    resumeUrl: dto.resumeUrl,
    resumeFileName: dto.resumeFileName,
    resumeMimeType: dto.resumeMimeType,
    resumeUploadedAt: dto.resumeUploadedAt,
    department: dto.department,
    designation: dto.designation,
    status: dto.status as EmployeeDirectoryInfo["status"],
    reportsToEmployeeId: dto.reportsToEmployeeId,
  };
}

function mergeEmployeeDirectory(
  row: EmployeeDocument,
  detailDoc?: EmployeeDetailsDocument,
): EmployeeDirectoryInfo | undefined {
  const fromCollection = detailDoc
    ? detailsToDirectory(employeeDetailsDocToDTO(detailDoc))
    : {};
  const embedded = row.directory ?? {};
  const merged: EmployeeDirectoryInfo = {
    workEmail: fromCollection.workEmail ?? embedded.workEmail,
    phone: fromCollection.phone ?? embedded.phone,
    location: fromCollection.location ?? embedded.location,
    fullAddress: fromCollection.fullAddress ?? embedded.fullAddress,
    currentAddress: fromCollection.currentAddress ?? embedded.currentAddress,
    permanentAddress: fromCollection.permanentAddress ?? embedded.permanentAddress,
    joinedDate: fromCollection.joinedDate ?? embedded.joinedDate,
    notes: fromCollection.notes ?? embedded.notes,
    resumeUrl: fromCollection.resumeUrl ?? embedded.resumeUrl,
    resumeFileName: fromCollection.resumeFileName ?? embedded.resumeFileName,
    resumeMimeType: fromCollection.resumeMimeType ?? embedded.resumeMimeType,
    resumeUploadedAt: fromCollection.resumeUploadedAt ?? embedded.resumeUploadedAt,
    department: fromCollection.department ?? embedded.department,
    designation: fromCollection.designation ?? embedded.designation,
    status: (fromCollection.status ?? embedded.status) as EmployeeDirectoryInfo["status"],
    reportsToEmployeeId: fromCollection.reportsToEmployeeId ?? embedded.reportsToEmployeeId,
  };
  const hasValue = Object.values(merged).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  return hasValue ? merged : undefined;
}

export async function listEmployees(opts?: {
  includeImages?: boolean;
}): Promise<Employee[]> {
  if (!allowInMemoryFallback()) {
    const db = await requireDb();
    await ensureMongoSeed(db);
    return listEmployeesFromDb(db, opts);
  }
  const db = await getDb();
  if (!db) return [];
  return listEmployeesFromDb(db, opts);
}

async function purgeOrphanEmployeeRecords(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
) {
  const em = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const det = db.collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails);
  const appUsers = await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .find({})
    .toArray();
  const employees = await em.find({}).toArray();
  if (employees.length === 0) return;

  const detailRows = await det.find({}).toArray();
  const detailsByRef = new Map(
    detailRows.map((row) => [row.employeeRef.toHexString(), row]),
  );
  const linkedIds = collectLinkedEmployeeIds(employees, appUsers, detailsByRef);
  const orphanIds = employees
    .map((row) => row._id)
    .filter((id) => !linkedIds.has(id.toHexString()));
  if (orphanIds.length === 0) return;

  const orphanHex = orphanIds.map((id) => id.toHexString());
  await det.deleteMany({ employeeRef: { $in: orphanIds } });
  await em.deleteMany({ _id: { $in: orphanIds } });
  await db.collection<ProjectDocument>(COLLECTIONS.projects).updateMany(
    { memberIds: { $in: orphanHex } },
    {
      $pull: { memberIds: { $in: orphanHex } },
      $set: { updatedAt: new Date() },
    },
  );
}

async function listEmployeesFromDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  opts?: { includeImages?: boolean },
): Promise<Employee[]> {
  const includeImages = opts?.includeImages === true;
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const detCol = db.collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails);
  const [appUsers, rows] = await Promise.all([
    db.collection<AppUserDocument>(COLLECTIONS.appUsers).find({}).toArray(),
    // Omit imageUrl at the DB layer for list payloads — huge data-URLs dominate transfer time.
    includeImages
      ? col.find({}).sort({ name: 1 }).toArray()
      : col
          .find({}, { projection: { imageUrl: 0 } })
          .sort({ name: 1 })
          .toArray(),
  ]);
  const detailRows =
    rows.length === 0
      ? []
      : await detCol.find({ employeeRef: { $in: rows.map((r) => r._id) } }).toArray();
  const byRef = new Map(
    detailRows.map((d) => [d.employeeRef.toHexString(), d]),
  );
  const linkedIds = collectLinkedEmployeeIds(rows, appUsers, byRef);
  return rows
    .filter((row) => linkedIds.has(row._id.toHexString()))
    .map((d) => {
      const base = employeeDocToDTO(d);
      const imageUrl = includeImages ? (base.imageUrl ?? "") : "";
      const doc = byRef.get(base.id);
      const directory = mergeEmployeeDirectory(d, doc);
      return directory ? { ...base, imageUrl, directory } : { ...base, imageUrl };
    });
}

export async function getEmployeeDetailBySlugOrId(
  slugOrId: string,
): Promise<EmployeeDetail | null> {
  const [employees, projects] = await Promise.all([
    listEmployees({ includeImages: true }),
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

async function createEmployeeInDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  input: Omit<Employee, "id">,
): Promise<Employee> {
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

export async function createEmployee(
  input: Omit<Employee, "id">,
): Promise<Employee> {
  if (!allowInMemoryFallback()) {
    const db = await requireDb();
    await ensureMongoSeed(db);
    return createEmployeeInDb(db, input);
  }
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
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
  return createEmployeeInDb(db, input);
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
    fullAddress:
      directory.fullAddress !== undefined
        ? directory.fullAddress || undefined
        : existing?.fullAddress,
    currentAddress:
      directory.currentAddress !== undefined
        ? directory.currentAddress || undefined
        : existing?.currentAddress,
    permanentAddress:
      directory.permanentAddress !== undefined
        ? directory.permanentAddress || undefined
        : existing?.permanentAddress,
    joinedDate:
      directory.joinedDate !== undefined
        ? directory.joinedDate || undefined
        : existing?.joinedDate,
    department:
      directory.department !== undefined
        ? directory.department || undefined
        : existing?.department,
    designation:
      directory.designation !== undefined
        ? directory.designation || undefined
        : existing?.designation,
    status:
      directory.status !== undefined ? directory.status || undefined : existing?.status,
    reportsToEmployeeRef:
      directory.reportsToEmployeeId !== undefined
        ? directory.reportsToEmployeeId && ObjectId.isValid(directory.reportsToEmployeeId)
          ? new ObjectId(directory.reportsToEmployeeId)
          : undefined
        : existing?.reportsToEmployeeRef,
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
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
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
      ...(employeePatch.gender !== undefined ? { gender: employeePatch.gender } : {}),
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
    if (allowInMemoryFallback()) {
      const list = memoryStore.employees;
      const idx = list.findIndex((e) => e.id === normalizedId);
      if (idx < 0) throw new Error("Employee not found");
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
        ...(employeePatch.gender !== undefined ? { gender: employeePatch.gender } : {}),
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
    throw new Error("Invalid employee id");
  }

  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const oid = new ObjectId(normalizedId);
  const updates: Partial<EmployeeDocument> = { updatedAt: new Date() };
  if (employeePatch.employeeId !== undefined) updates.employeeId = employeePatch.employeeId;
  if (employeePatch.name !== undefined) updates.name = employeePatch.name;
  if (employeePatch.team !== undefined) updates.team = employeePatch.team;
  if (employeePatch.role !== undefined) updates.role = employeePatch.role;
  if (employeePatch.gender !== undefined) updates.gender = employeePatch.gender;
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
  const directory = mergeEmployeeDirectory(row, detailDoc ?? undefined);
  const updated = directory ? { ...base, directory } : base;

  const workEmail = (
    updated.directory?.workEmail ??
    (row as { email?: string }).email ??
    ""
  )
    .trim()
    .toLowerCase();
  if (workEmail) {
    const { syncAppUserFromEmployeeByEmail } = await import("@/lib/app-users");
    await syncAppUserFromEmployeeByEmail(workEmail, {
      ...(employeePatch.name !== undefined ? { name: employeePatch.name } : {}),
      ...(employeePatch.employeeId !== undefined
        ? { employeeId: employeePatch.employeeId }
        : {}),
      ...(employeePatch.team !== undefined
        ? { team: employeePatch.team as import("@/types").TeamName }
        : {}),
      ...(employeePatch.imageUrl !== undefined ? { imageUrl: employeePatch.imageUrl } : {}),
    });
  }

  return updated;
}

export async function deleteEmployee(id: string): Promise<void> {
  const db = await getDb();
  const normalizedId = String(id).trim();
  if (!normalizedId || normalizedId === "undefined") {
    throw new Error("Invalid employee id");
  }
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const list = memoryStore.employees;
    const idx = list.findIndex((e) => e.id === normalizedId);
    if (idx >= 0) list.splice(idx, 1);
    return;
  }

  if (!ObjectId.isValid(normalizedId)) {
    if (allowInMemoryFallback()) {
      const list = memoryStore.employees;
      const idx = list.findIndex((e) => e.id === normalizedId);
      if (idx >= 0) list.splice(idx, 1);
      return;
    }
    throw new Error("Invalid employee id");
  }

  const oid = new ObjectId(normalizedId);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const emp = await col.findOne({ _id: oid });
  if (!emp) throw new Error("Employee not found");

  const detCol = db.collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails);
  const detail = await detCol.findOne({ employeeRef: oid });
  const emails = new Set<string>();
  for (const value of [
    emp.email,
    emp.directory?.workEmail,
    emp.directory?.personalEmail,
    detail?.workEmail,
  ]) {
    if (typeof value === "string" && value.trim()) {
      emails.add(value.toLowerCase().trim());
    }
  }

  await detCol.deleteMany({ employeeRef: oid });
  await db.collection<ProjectDocument>(COLLECTIONS.projects).updateMany(
    { memberIds: normalizedId },
    { $pull: { memberIds: normalizedId }, $set: { updatedAt: new Date() } },
  );

  const appUserFilters: Record<string, unknown>[] = [];
  if (emails.size > 0) {
    appUserFilters.push({ email: { $in: [...emails] } });
  }
  if (emp.employeeId?.trim()) {
    appUserFilters.push({ employeeId: emp.employeeId.trim() });
  }
  if (appUserFilters.length > 0) {
    await db.collection(COLLECTIONS.appUsers).deleteMany({ $or: appUserFilters });
  }

  await col.deleteOne({ _id: oid });
}

export async function assignEmployeeToBay(
  bayId: string,
  employeeId: string | null,
  officeSlug?: string | null,
): Promise<Employee[]> {
  const { getFloorPlanBySlug, isSeatOnPlan, normalizeOfficeSlug } = await import(
    "@/lib/floor-plans"
  );
  const office = normalizeOfficeSlug(officeSlug);
  const plan = await getFloorPlanBySlug(office);
  if (!plan || !plan.isActive) {
    throw new Error(`Unknown office floor plan "${office}".`);
  }
  if (!isSeatOnPlan(bayId, plan)) {
    throw new Error(
      `Invalid seat "${bayId}" for ${plan.name}. Pick a seat from that office floor plan.`,
    );
  }

  const matchesOffice = (slug?: string | null) => normalizeOfficeSlug(slug) === office;

  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const list = memoryStore.employees;
    for (const e of list) {
      if (e.bayNumber === bayId && matchesOffice(e.officeSlug)) {
        e.bayNumber = "";
        e.officeSlug = undefined;
      }
    }
    if (employeeId) {
      const emp = list.find((e) => e.id === employeeId);
      if (emp) {
        emp.bayNumber = bayId;
        emp.officeSlug = office;
        emp.cabinId = undefined;
      }
    }
    return list.map((e) => ({ ...e }));
  }
  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);

  // Clear current occupants of this seat on this office (legacy null slug = chennai).
  const occupants = await col
    .find({ bayNumber: bayId })
    .project({ _id: 1, officeSlug: 1 })
    .toArray();
  const clearIds = occupants
    .filter((row) => matchesOffice(row.officeSlug))
    .map((row) => row._id);
  if (clearIds.length > 0) {
    await col.updateMany(
      { _id: { $in: clearIds } },
      { $set: { bayNumber: "", officeSlug: null, cabinId: null, updatedAt: new Date() } },
    );
  }

  if (employeeId) {
    if (!ObjectId.isValid(employeeId)) {
      throw new Error("Invalid employee id");
    }
    await col.updateOne(
      { _id: new ObjectId(employeeId) },
      {
        $set: {
          bayNumber: bayId,
          officeSlug: office,
          cabinId: null,
          updatedAt: new Date(),
        },
      },
    );
  }
  return listEmployees();
}

/** Swap (or move) seating between two bays on the same office floor plan. */
export async function swapEmployeesBetweenBays(
  fromBayId: string,
  toBayId: string,
  officeSlug?: string | null,
): Promise<Employee[]> {
  const from = fromBayId.trim();
  const to = toBayId.trim();
  if (!from || !to) throw new Error("Both seats are required to swap.");
  if (from === to) return listEmployees();

  const { getFloorPlanBySlug, isSeatOnPlan, normalizeOfficeSlug } = await import(
    "@/lib/floor-plans"
  );
  const office = normalizeOfficeSlug(officeSlug);
  const plan = await getFloorPlanBySlug(office);
  if (!plan || !plan.isActive) {
    throw new Error(`Unknown office floor plan "${office}".`);
  }
  if (!isSeatOnPlan(from, plan) || !isSeatOnPlan(to, plan)) {
    throw new Error(
      `Invalid seat for ${plan.name}. Pick seats from that office floor plan.`,
    );
  }

  const matchesOffice = (slug?: string | null) => normalizeOfficeSlug(slug) === office;

  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const list = memoryStore.employees;
    const fromEmp = list.find(
      (e) => e.bayNumber === from && matchesOffice(e.officeSlug),
    );
    if (!fromEmp) {
      throw new Error(`No employee is seated at ${from}.`);
    }
    const toEmp = list.find(
      (e) => e.bayNumber === to && matchesOffice(e.officeSlug),
    );
    fromEmp.bayNumber = to;
    fromEmp.officeSlug = office;
    fromEmp.cabinId = undefined;
    if (toEmp) {
      toEmp.bayNumber = from;
      toEmp.officeSlug = office;
      toEmp.cabinId = undefined;
    }
    return list.map((e) => ({ ...e }));
  }

  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const seated = await col
    .find({ bayNumber: { $in: [from, to] } })
    .project({ _id: 1, bayNumber: 1, officeSlug: 1 })
    .toArray();

  const fromRows = seated.filter(
    (row) => row.bayNumber === from && matchesOffice(row.officeSlug),
  );
  const toRows = seated.filter(
    (row) => row.bayNumber === to && matchesOffice(row.officeSlug),
  );
  if (fromRows.length === 0) {
    throw new Error(`No employee is seated at ${from}.`);
  }

  const fromId = fromRows[0]._id;
  const toId = toRows[0]?._id;
  const now = new Date();

  if (!toId) {
    // Move into vacant seat.
    await col.updateOne(
      { _id: fromId },
      {
        $set: {
          bayNumber: to,
          officeSlug: office,
          cabinId: null,
          updatedAt: now,
        },
      },
    );
  } else {
    await col.bulkWrite([
      {
        updateOne: {
          filter: { _id: fromId },
          update: {
            $set: {
              bayNumber: to,
              officeSlug: office,
              cabinId: null,
              updatedAt: now,
            },
          },
        },
      },
      {
        updateOne: {
          filter: { _id: toId },
          update: {
            $set: {
              bayNumber: from,
              officeSlug: office,
              cabinId: null,
              updatedAt: now,
            },
          },
        },
      },
    ]);
  }

  return listEmployees();
}

export async function assignEmployeeToCabin(
  cabinId: string,
  employeeId: string | null,
  officeSlug?: string | null,
): Promise<Employee[]> {
  const { getFloorPlanBySlug, normalizeOfficeSlug } = await import("@/lib/floor-plans");
  const { isCabinOnPlan } = await import("@/lib/cabin-utils");
  const office = normalizeOfficeSlug(officeSlug);
  const plan = await getFloorPlanBySlug(office);
  if (!plan || !plan.isActive) {
    throw new Error(`Unknown office floor plan "${office}".`);
  }
  if (!isCabinOnPlan(cabinId, plan)) {
    throw new Error(
      `Invalid cabin "${cabinId}" for ${plan.name}. Pick a cabin from that office floor plan.`,
    );
  }

  const matchesOffice = (slug?: string | null) => normalizeOfficeSlug(slug) === office;
  const cabin = cabinId.trim();

  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const list = memoryStore.employees;
    for (const e of list) {
      if (e.cabinId === cabin && matchesOffice(e.officeSlug)) {
        e.cabinId = undefined;
        e.officeSlug = undefined;
      }
    }
    if (employeeId) {
      const emp = list.find((e) => e.id === employeeId);
      if (emp) {
        emp.cabinId = cabin;
        emp.officeSlug = office;
        emp.bayNumber = "";
      }
    }
    return list.map((e) => ({ ...e }));
  }
  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);

  const occupants = await col
    .find({ cabinId: cabin })
    .project({ _id: 1, officeSlug: 1 })
    .toArray();
  const clearIds = occupants
    .filter((row) => matchesOffice(row.officeSlug))
    .map((row) => row._id);
  if (clearIds.length > 0) {
    await col.updateMany(
      { _id: { $in: clearIds } },
      { $set: { cabinId: null, officeSlug: null, updatedAt: new Date() } },
    );
  }

  if (employeeId) {
    if (!ObjectId.isValid(employeeId)) {
      throw new Error("Invalid employee id");
    }
    await col.updateOne(
      { _id: new ObjectId(employeeId) },
      {
        $set: {
          cabinId: cabin,
          officeSlug: office,
          bayNumber: "",
          updatedAt: new Date(),
        },
      },
    );
  }
  return listEmployees();
}

/** Set exact membership for a cabin (team cabins / clear-all with []). */
export async function setCabinEmployees(
  cabinId: string,
  employeeIds: string[],
  officeSlug?: string | null,
): Promise<Employee[]> {
  const { getFloorPlanBySlug, normalizeOfficeSlug } = await import("@/lib/floor-plans");
  const { isCabinOnPlan } = await import("@/lib/cabin-utils");
  const office = normalizeOfficeSlug(officeSlug);
  const plan = await getFloorPlanBySlug(office);
  if (!plan || !plan.isActive) {
    throw new Error(`Unknown office floor plan "${office}".`);
  }
  if (!isCabinOnPlan(cabinId, plan)) {
    throw new Error(
      `Invalid cabin "${cabinId}" for ${plan.name}. Pick a cabin from that office floor plan.`,
    );
  }

  const matchesOffice = (slug?: string | null) => normalizeOfficeSlug(slug) === office;
  const cabin = cabinId.trim();
  const uniqueIds = [...new Set(employeeIds.map((id) => id.trim()).filter(Boolean))];
  for (const id of uniqueIds) {
    if (!ObjectId.isValid(id)) throw new Error(`Invalid employee id: ${id}`);
  }
  const selected = new Set(uniqueIds);

  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const list = memoryStore.employees;
    for (const e of list) {
      if (e.cabinId === cabin && matchesOffice(e.officeSlug) && !selected.has(e.id)) {
        e.cabinId = undefined;
        e.officeSlug = undefined;
      }
    }
    for (const id of uniqueIds) {
      const emp = list.find((e) => e.id === id);
      if (emp) {
        emp.cabinId = cabin;
        emp.officeSlug = office;
        emp.bayNumber = "";
      }
    }
    return list.map((e) => ({ ...e }));
  }

  await ensureMongoSeed(db);
  const col = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const occupants = await col
    .find({ cabinId: cabin })
    .project({ _id: 1, officeSlug: 1 })
    .toArray();
  const clearIds = occupants
    .filter((row) => matchesOffice(row.officeSlug) && !selected.has(String(row._id)))
    .map((row) => row._id);
  if (clearIds.length > 0) {
    await col.updateMany(
      { _id: { $in: clearIds } },
      { $set: { cabinId: null, officeSlug: null, updatedAt: new Date() } },
    );
  }
  if (uniqueIds.length > 0) {
    await col.updateMany(
      { _id: { $in: uniqueIds.map((id) => new ObjectId(id)) } },
      {
        $set: {
          cabinId: cabin,
          officeSlug: office,
          bayNumber: "",
          updatedAt: new Date(),
        },
      },
    );
  }
  return listEmployees();
}

export async function listProjects(): Promise<Project[]> {
  if (!allowInMemoryFallback()) {
    const db = await requireDb();
    await ensureMongoSeed(db);
    return listProjectsFromDb(db);
  }
  const db = await getDb();
  if (!db) return [];
  return listProjectsFromDb(db);
}

async function listProjectsFromDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<Project[]> {
  const catalog = await listTeams();
  const rows = await db
    .collection<ProjectDocument>(COLLECTIONS.projects)
    .find({})
    .sort({ assignedDate: -1 })
    .toArray();
  return rows.map((d) => {
    const dto = projectDocToDTO(d);
    const resolved = resolveProjectTeamsFromDoc(d, catalog);
    return {
      ...dto,
      teams: mergeProjectTeamNames(resolved, d),
    };
  });
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  if (!allowInMemoryFallback()) {
    const db = await requireDb();
    await ensureMongoSeed(db);
    return getProjectBySlugFromDb(db, slug);
  }
  const db = await getDb();
  if (!db) {
    return memoryStore.projects.find((p) => p.slug === slug) ?? null;
  }
  return getProjectBySlugFromDb(db, slug);
}

async function getProjectBySlugFromDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  slug: string,
): Promise<Project | null> {
  const catalog = await listTeams();
  const doc = await db
    .collection<ProjectDocument>(COLLECTIONS.projects)
    .findOne({ slug });
  if (!doc) return null;
  const dto = projectDocToDTO(doc);
  const resolved = resolveProjectTeamsFromDoc(doc, catalog);
  return { ...dto, teams: mergeProjectTeamNames(resolved, doc) };
}

export async function getProjectDetailBySlug(
  slug: string,
): Promise<ProjectDetail | null> {
  const project = await getProjectBySlug(slug);
  if (!project) return null;
  const employees = await listEmployees();
  const detail = toDetail(project, employees);

  if (!project.projectManagerId) {
    return { ...detail, projectManager: null };
  }

  const account = await getAppUserPublicById(project.projectManagerId);
  if (account && isProjectManagerAppRole(account.appRole)) {
    return {
      ...detail,
      projectManager: {
        id: account.id,
        name: account.name,
        email: account.email,
        imageUrl: account.imageUrl,
        appRole: account.appRole,
      },
    };
  }

  return { ...detail, projectManager: null };
}

export async function createProject(
  input: Omit<Project, "id" | "slug"> & { slug?: string },
  options?: { actor?: { id: string; name: string } },
): Promise<Project> {
  const memberIds = input.memberIds ?? [];
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const existing = memoryStore.projects.map((p) => p.slug);
    const slug =
      input.slug ?? uniqueProjectSlug(input.name, existing);
    const row: Project = {
      ...input,
      clientName: input.clientName ?? "",
      projectManagerId: input.projectManagerId ?? "",
      teamLeadId: input.teamLeadId ?? "",
      description: input.description ?? "",
      memberIds,
      slug,
      id: `p-${Date.now()}`,
    };
    memoryStore.projects.push(row);
    if (memberIds.length > 0) {
      const { notifyNewProjectMembers } = await import("@/lib/notifications-data");
      await notifyNewProjectMembers({
        project: row,
        previousMemberIds: [],
        nextMemberIds: memberIds,
        actor: options?.actor,
      });
    }
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
    clientName: input.clientName ?? "",
    projectManagerId: input.projectManagerId ?? "",
    teamLeadId: input.teamLeadId ?? "",
    teams: input.teams,
    assignedDate: input.assignedDate,
    lastDate: input.lastDate,
    status: input.status,
    description: input.description ?? "",
    memberIds,
    updatedAt: new Date(),
  };
  await col.insertOne(doc);
  const catalog = await listTeams();
  const dto = projectDocToDTO(doc);
  const resolved = resolveProjectTeamsFromDoc(doc, catalog);
  const created = { ...dto, teams: mergeProjectTeamNames(resolved, doc) };
  if (memberIds.length > 0) {
    const { notifyNewProjectMembers } = await import("@/lib/notifications-data");
    await notifyNewProjectMembers({
      project: created,
      previousMemberIds: [],
      nextMemberIds: memberIds,
      actor: options?.actor,
    });
  }
  return created;
}

export async function updateProjectBySlug(
  slug: string,
  patch: Partial<
    Pick<
      Project,
      | "name"
      | "clientName"
      | "projectManagerId"
      | "teamLeadId"
      | "teams"
      | "assignedDate"
      | "lastDate"
      | "status"
      | "description"
      | "memberIds"
    >
  >,
  options?: { actor?: { id: string; name: string } },
): Promise<Project | null> {
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const idx = memoryStore.projects.findIndex((p) => p.slug === slug);
    if (idx < 0) return null;
    const current = memoryStore.projects[idx];
    const next: Project = {
      ...current,
      ...patch,
      memberIds: patch.memberIds ?? current.memberIds,
    };
    memoryStore.projects[idx] = next;
    if (patch.memberIds !== undefined) {
      const { notifyNewProjectMembers } = await import("@/lib/notifications-data");
      await notifyNewProjectMembers({
        project: next,
        previousMemberIds: current.memberIds,
        nextMemberIds: patch.memberIds,
        actor: options?.actor,
      });
    }
    return next;
  }
  await ensureMongoSeed(db);
  const col = db.collection<ProjectDocument>(COLLECTIONS.projects);
  const existing = await col.findOne({ slug });
  if (!existing) return null;
  const catalog = await listTeams();
  const current = projectDocToDTO(existing);

  const result = await col.findOneAndUpdate(
    { slug },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!result) return null;
  const dto = projectDocToDTO(result);
  const resolved = resolveProjectTeamsFromDoc(result, catalog);
  const updated = { ...dto, teams: mergeProjectTeamNames(resolved, result) };

  if (patch.memberIds !== undefined) {
    const { notifyNewProjectMembers } = await import("@/lib/notifications-data");
    await notifyNewProjectMembers({
      project: updated,
      previousMemberIds: current.memberIds,
      nextMemberIds: patch.memberIds,
      actor: options?.actor,
    });
  }

  return updated;
}

export async function getProjectById(id: string): Promise<Project | null> {
  if (!ObjectId.isValid(id)) return null;
  if (!allowInMemoryFallback()) {
    const db = await requireDb();
    await ensureMongoSeed(db);
    return getProjectByIdFromDb(db, id);
  }
  const db = await getDb();
  if (!db) {
    return memoryStore.projects.find((project) => project.id === id) ?? null;
  }
  return getProjectByIdFromDb(db, id);
}

async function getProjectByIdFromDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  id: string,
): Promise<Project | null> {
  const catalog = await listTeams();
  const doc = await db.collection<ProjectDocument>(COLLECTIONS.projects).findOne({
    _id: new ObjectId(id),
  });
  if (!doc) return null;
  const dto = projectDocToDTO(doc);
  const resolved = resolveProjectTeamsFromDoc(doc, catalog);
  return { ...dto, teams: mergeProjectTeamNames(resolved, doc) };
}

export async function updateProjectById(
  id: string,
  patch: Partial<
    Pick<
      Project,
      | "name"
      | "clientName"
      | "projectManagerId"
      | "teamLeadId"
      | "teams"
      | "assignedDate"
      | "lastDate"
      | "status"
      | "description"
      | "memberIds"
    >
  >,
  options?: { actor?: { id: string; name: string } },
): Promise<Project | null> {
  const project = await getProjectById(id);
  if (!project) return null;
  return updateProjectBySlug(project.slug, patch, options);
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
  options?: { actor?: { id: string; name: string } },
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

    await updateProjectBySlug(project.slug, { memberIds }, { actor: options?.actor });
  }

  return listProjects();
}

export async function listGallery(): Promise<GalleryImage[]> {
  if (!allowInMemoryFallback()) {
    const db = await requireDb();
    await ensureMongoSeed(db);
    return listGalleryFromDb(db);
  }
  const db = await getDb();
  if (!db) return [];
  return listGalleryFromDb(db);
}

async function listGalleryFromDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<GalleryImage[]> {
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
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
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
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
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
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
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
