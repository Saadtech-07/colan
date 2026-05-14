import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { memoryStore } from "@/lib/memory-store";
import type { Employee, GalleryImage, Project } from "@/types";
import {
  MOCK_EMPLOYEES,
  MOCK_GALLERY,
  MOCK_PROJECTS,
} from "@/lib/mock-data";

const C = {
  employees: "employees",
  projects: "projects",
  gallery: "gallery",
} as const;

type EmployeeDoc = Omit<Employee, "id"> & { _id: ObjectId };
type ProjectDoc = Omit<Project, "id"> & { _id: ObjectId };
type GalleryDoc = Omit<GalleryImage, "id"> & { _id: ObjectId };

function empFromDoc(d: EmployeeDoc): Employee {
  return {
    id: d._id.toHexString(),
    employeeId: d.employeeId,
    name: d.name,
    team: d.team,
    role: d.role,
    bayNumber: d.bayNumber,
    imageUrl: d.imageUrl,
  };
}

function projFromDoc(d: ProjectDoc): Project {
  return {
    id: d._id.toHexString(),
    name: d.name,
    team: d.team,
    assignedDate: d.assignedDate,
    lastDate: d.lastDate,
    status: d.status,
  };
}

function galFromDoc(d: GalleryDoc): GalleryImage {
  return {
    id: d._id.toHexString(),
    url: d.url,
    title: d.title,
    caption: d.caption,
    uploadedAt: d.uploadedAt,
  };
}

async function ensureMongoSeed(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const em = db.collection<EmployeeDoc>(C.employees);
  if ((await em.countDocuments()) === 0) {
    await em.insertMany(
      MOCK_EMPLOYEES.map(({ id: _id, ...rest }) => ({
        ...rest,
        _id: new ObjectId(),
      })) as EmployeeDoc[],
    );
  }
  const pr = db.collection<ProjectDoc>(C.projects);
  if ((await pr.countDocuments()) === 0) {
    await pr.insertMany(
      MOCK_PROJECTS.map(({ id: _id, ...rest }) => ({
        ...rest,
        _id: new ObjectId(),
      })) as ProjectDoc[],
    );
  }
  const ga = db.collection<GalleryDoc>(C.gallery);
  if ((await ga.countDocuments()) === 0) {
    await ga.insertMany(
      MOCK_GALLERY.map(({ id: _id, ...rest }) => ({
        ...rest,
        _id: new ObjectId(),
      })) as GalleryDoc[],
    );
  }
}

export async function listEmployees(): Promise<Employee[]> {
  const db = await getDb();
  if (!db) return memoryStore.employees.map((e) => ({ ...e }));
  await ensureMongoSeed(db);
  const rows = await db
    .collection<EmployeeDoc>(C.employees)
    .find({})
    .sort({ name: 1 })
    .toArray();
  return rows.map((d) => empFromDoc(d));
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
  const col = db.collection<EmployeeDoc>(C.employees);
  await col.updateMany({ bayNumber: input.bayNumber }, { $set: { bayNumber: "" } });
  const _id = new ObjectId();
  const doc: EmployeeDoc = { _id, ...input };
  await col.insertOne(doc);
  return empFromDoc(doc);
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
  const col = db.collection<EmployeeDoc>(C.employees);
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
    .collection<ProjectDoc>(C.projects)
    .find({})
    .sort({ assignedDate: -1 })
    .toArray();
  return rows.map(projFromDoc);
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
  const doc: ProjectDoc = { _id, ...input };
  await db.collection<ProjectDoc>(C.projects).insertOne(doc);
  return projFromDoc(doc);
}

export async function listGallery(): Promise<GalleryImage[]> {
  const db = await getDb();
  if (!db) return memoryStore.gallery.map((g) => ({ ...g }));
  await ensureMongoSeed(db);
  const rows = await db
    .collection<GalleryDoc>(C.gallery)
    .find({})
    .sort({ uploadedAt: -1 })
    .toArray();
  return rows.map(galFromDoc);
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
  const doc: GalleryDoc = { _id, ...input };
  await db.collection<GalleryDoc>(C.gallery).insertOne(doc);
  return galFromDoc(doc);
}
