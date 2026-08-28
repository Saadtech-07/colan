import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { allowInMemoryFallback } from "@/lib/data-backend";
import { teamSlugFromName } from "@/lib/team-utils";
import { DEMO_COMPANY_ID, companyScope, toCompanyObjectId } from "@/lib/tenant-scope";
import { ensureDefaultCompany } from "@/lib/tenant-migration";
import { ensureRolesSeedForCompany } from "@/lib/roles-data";
import {
  COLLECTIONS,
  companyDocToDTO,
  ensureColanModelIndexes,
  type AppUserDocument,
  type CompanyDocument,
  type CompanyDTO,
  type EmployeeDocument,
} from "@/models";

type MemoryCompany = CompanyDTO;

const memoryCompanies: MemoryCompany[] = [
  {
    id: DEMO_COMPANY_ID,
    name: "Colan Infotech",
    slug: "colan",
  },
];

function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function getCompanyById(id: string): Promise<CompanyDTO | null> {
  const db = await getDb();
  if (!db) {
    return memoryCompanies.find((row) => row.id === id) ?? null;
  }
  if (!ObjectId.isValid(id)) return null;
  await ensureColanModelIndexes(db);
  const doc = await db
    .collection<CompanyDocument>(COLLECTIONS.companies)
    .findOne({ _id: new ObjectId(id) });
  return doc ? companyDocToDTO(doc) : null;
}

export async function getCompanyBySlug(slug: string): Promise<CompanyDTO | null> {
  const normalized = slug.trim().toLowerCase();
  const db = await getDb();
  if (!db) {
    return memoryCompanies.find((row) => row.slug === normalized) ?? null;
  }
  await ensureColanModelIndexes(db);
  const doc = await db
    .collection<CompanyDocument>(COLLECTIONS.companies)
    .findOne({ slug: normalized });
  return doc ? companyDocToDTO(doc) : null;
}

/** Ensures the legacy default workspace exists and backfills tenant fields on old rows. */
export async function resolveDefaultCompanyId(): Promise<string> {
  const db = await getDb();
  if (!db) return DEMO_COMPANY_ID;
  const id = await ensureDefaultCompany(db);
  return id.toHexString();
}

export type OnboardCompanyInput = {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

export type OnboardCompanyResult = {
  company: CompanyDTO;
  admin: {
    id: string;
    email: string;
    name: string;
    appRole: "admin";
    companyId: string;
  };
};

/** Create a new tenant workspace and invite the first admin account. */
export async function onboardCompany(input: OnboardCompanyInput): Promise<OnboardCompanyResult> {
  const companyName = input.companyName.trim();
  const adminName = input.adminName.trim();
  const adminEmail = input.adminEmail.toLowerCase().trim();
  const adminPassword = input.adminPassword;

  if (!companyName) throw new Error("Company name is required.");
  if (!adminName) throw new Error("Admin name is required.");
  if (!adminEmail) throw new Error("Admin email is required.");
  if (adminPassword.length < 8) {
    throw new Error("Admin password must be at least 8 characters.");
  }

  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const company: CompanyDTO = {
      id: new ObjectId().toHexString(),
      name: companyName,
      slug: teamSlugFromName(companyName) || "workspace",
    };
    memoryCompanies.push(company);
    return {
      company,
      admin: {
        id: new ObjectId().toHexString(),
        email: adminEmail,
        name: adminName,
        appRole: "admin",
        companyId: company.id,
      },
    };
  }

  await ensureColanModelIndexes(db);
  const companiesCol = db.collection<CompanyDocument>(COLLECTIONS.companies);
  const appUsersCol = db.collection<AppUserDocument>(COLLECTIONS.appUsers);

  const existingUser = await appUsersCol.findOne({ email: adminEmail });
  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const baseSlug = teamSlugFromName(companyName) || "workspace";
  const takenSlugs = new Set(
    (await companiesCol.find({}, { projection: { slug: 1 } }).toArray()).map((row) => row.slug),
  );
  const slug = uniqueSlug(baseSlug, takenSlugs);

  const companyId = new ObjectId();
  const now = new Date();
  await companiesCol.insertOne({
    _id: companyId,
    name: companyName,
    slug,
    createdAt: now,
    updatedAt: now,
  });

  await ensureRolesSeedForCompany(db, companyId.toHexString());

  const employeeId = `ADM-${Date.now().toString(36).toUpperCase()}`;
  const employeeCol = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const employeeRef = new ObjectId();
  await employeeCol.insertOne({
    _id: employeeRef,
    companyId,
    employeeId,
    name: adminName,
    team: "React Team",
    role: "Admin",
    gender: "male",
    bayNumber: "",
    officeSlug: null,
    cabinId: null,
    imageUrl: "",
    email: adminEmail,
    createdAt: now,
    updatedAt: now,
  });

  const adminUserId = new ObjectId();
  await appUsersCol.insertOne({
    _id: adminUserId,
    companyId,
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPassword, 10),
    name: adminName,
    appRole: "admin",
    employeeId,
    imageUrl: "",
    isProfileCompleted: true,
    updatedProfileAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return {
    company: {
      id: companyId.toHexString(),
      name: companyName,
      slug,
      createdAt: now.toISOString(),
    },
    admin: {
      id: adminUserId.toHexString(),
      email: adminEmail,
      name: adminName,
      appRole: "admin",
      companyId: companyId.toHexString(),
    },
  };
}

export async function listCompanies(): Promise<CompanyDTO[]> {
  const db = await getDb();
  if (!db) return [...memoryCompanies];
  await ensureColanModelIndexes(db);
  const rows = await db
    .collection<CompanyDocument>(COLLECTIONS.companies)
    .find({})
    .sort({ name: 1 })
    .toArray();
  return rows.map(companyDocToDTO);
}

export { companyScope, toCompanyObjectId };
