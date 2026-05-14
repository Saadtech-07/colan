import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { memoryStore } from "@/lib/memory-store";
import type { Employee, GalleryImage, Project } from "@/types";
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

async function ensureMongoSeed(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  await ensureColanModelIndexes(db);

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
    await pr.insertMany(
      MOCK_PROJECTS.map(({ id: _id, ...rest }) => ({
        ...rest,
        _id: new ObjectId(),
      })) as ProjectDocument[],
    );
  }
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

export async function createProject(
  input: Omit<Project, "id">,
): Promise<Project> {
  const db = await getDb();
  if (!db) {
    const row: Project = { ...input, id: `p-${Date.now()}` };
    memoryStore.projects.push(row);
    return row;
  }
  await ensureMongoSeed(db);
  const _id = new ObjectId();
  const doc: ProjectDocument = { _id, ...input };
  await db.collection<ProjectDocument>(COLLECTIONS.projects).insertOne(doc);
  return projectDocToDTO(doc);
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
