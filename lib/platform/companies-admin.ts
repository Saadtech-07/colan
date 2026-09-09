import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { onboardCompany, getCompanyById, listCompanies, type OnboardCompanyInput } from "@/lib/companies";
import { ensureRolesSeedForCompany } from "@/lib/roles-data";
import { writePlatformAuditLog } from "@/lib/platform/platform-audit";
import { toCompanyObjectId } from "@/lib/tenant-scope";
import {
  COLLECTIONS,
  companyDocToDTO,
  type AppUserDocument,
  type CompanyDocument,
  type CompanyDTO,
  type EmployeeDocument,
} from "@/models";

export type CompanyListItem = CompanyDTO & {
  adminEmail?: string;
  adminName?: string;
  userCount: number;
  employeeCount: number;
  roleCount: number;
};

export type CompanyDetail = CompanyListItem & {
  admins: Array<{ id: string; email: string; name: string; isActive: boolean }>;
};

export type CreateCompanyInput = OnboardCompanyInput & {
  city?: string;
  slug?: string;
};

async function countForCompany(companyId: ObjectId) {
  const db = await getDb();
  if (!db) {
    return { userCount: 0, employeeCount: 0, roleCount: 0 };
  }
  const scope = { companyId };
  const [userCount, employeeCount, roleCount] = await Promise.all([
    db.collection(COLLECTIONS.appUsers).countDocuments(scope),
    db.collection(COLLECTIONS.employees).countDocuments(scope),
    db.collection(COLLECTIONS.companyRoles).countDocuments(scope),
  ]);
  return { userCount, employeeCount, roleCount };
}

async function primaryAdminForCompany(companyId: ObjectId) {
  const db = await getDb();
  if (!db) return null;
  const admin = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).findOne({
    companyId,
    appRole: "admin",
  });
  if (!admin) return null;
  return {
    id: admin._id.toHexString(),
    email: admin.email,
    name: admin.name,
    isActive: admin.isActive !== false,
  };
}

export async function listCompaniesForPlatform(opts?: {
  search?: string;
  status?: "active" | "inactive" | "all";
}): Promise<CompanyListItem[]> {
  const companies = await listCompanies();
  const search = opts?.search?.trim().toLowerCase() ?? "";
  const status = opts?.status ?? "all";

  const db = await getDb();
  const items: CompanyListItem[] = [];

  for (const company of companies) {
    if (status !== "all" && company.status !== status) continue;
    if (
      search &&
      !company.name.toLowerCase().includes(search) &&
      !company.slug.toLowerCase().includes(search) &&
      !(company.city?.toLowerCase().includes(search) ?? false)
    ) {
      continue;
    }

    const companyOid = db && ObjectId.isValid(company.id) ? new ObjectId(company.id) : null;
    const counts = companyOid ? await countForCompany(companyOid) : { userCount: 0, employeeCount: 0, roleCount: 0 };
    const admin = companyOid ? await primaryAdminForCompany(companyOid) : null;

    items.push({
      ...company,
      adminEmail: admin?.email,
      adminName: admin?.name,
      userCount: counts.userCount,
      employeeCount: counts.employeeCount,
      roleCount: counts.roleCount,
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCompanyDetailForPlatform(id: string): Promise<CompanyDetail | null> {
  const company = await getCompanyById(id);
  if (!company) return null;
  if (!ObjectId.isValid(id)) {
    return {
      ...company,
      userCount: 0,
      employeeCount: 0,
      roleCount: 0,
      admins: [],
    };
  }

  const companyOid = new ObjectId(id);
  const counts = await countForCompany(companyOid);
  const db = await getDb();
  const admins =
    db
      ? await db
          .collection<AppUserDocument>(COLLECTIONS.appUsers)
          .find({ companyId: companyOid, appRole: "admin" })
          .sort({ createdAt: 1 })
          .toArray()
      : [];

  const primary = await primaryAdminForCompany(companyOid);

  return {
    ...company,
    adminEmail: primary?.email,
    adminName: primary?.name,
    userCount: counts.userCount,
    employeeCount: counts.employeeCount,
    roleCount: counts.roleCount,
    admins: admins.map((row) => ({
      id: row._id.toHexString(),
      email: row.email,
      name: row.name,
      isActive: row.isActive !== false,
    })),
  };
}

export async function createCompanyForPlatform(
  input: CreateCompanyInput,
  actor: { email: string; name: string },
) {
  const result = await onboardCompany(input);

  const db = await getDb();
  if (db && input.city?.trim()) {
    const companyOid = toCompanyObjectId(result.company.id);
    await db.collection<CompanyDocument>(COLLECTIONS.companies).updateOne(
      { _id: companyOid },
      { $set: { city: input.city.trim(), updatedAt: new Date() } },
    );
    result.company.city = input.city.trim();
  }

  if (db && input.slug?.trim()) {
    const slug = input.slug.trim().toLowerCase();
    const companyOid = toCompanyObjectId(result.company.id);
    const taken = await db.collection<CompanyDocument>(COLLECTIONS.companies).findOne({
      slug,
      _id: { $ne: companyOid },
    });
    if (taken) throw new Error("Company slug is already in use.");
    await db.collection<CompanyDocument>(COLLECTIONS.companies).updateOne(
      { _id: companyOid },
      { $set: { slug, updatedAt: new Date() } },
    );
    result.company.slug = slug;
  }

  await writePlatformAuditLog({
    actorEmail: actor.email,
    actorName: actor.name,
    action: "company.created",
    resourceType: "company",
    resourceId: result.company.id,
    companyId: result.company.id,
    metadata: { adminEmail: result.admin.email },
  });

  return result;
}

export async function updateCompanyForPlatform(
  id: string,
  patch: { name?: string; city?: string; slug?: string; status?: "active" | "inactive" },
  actor: { email: string; name: string },
): Promise<CompanyDTO | null> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(id)) return null;

  const companyOid = new ObjectId(id);
  const updates: Partial<CompanyDocument> = { updatedAt: new Date() };
  if (patch.name?.trim()) updates.name = patch.name.trim();
  if (patch.city !== undefined) updates.city = patch.city.trim() || undefined;
  if (patch.status) updates.status = patch.status;
  if (patch.slug?.trim()) {
    const slug = patch.slug.trim().toLowerCase();
    const taken = await db.collection<CompanyDocument>(COLLECTIONS.companies).findOne({
      slug,
      _id: { $ne: companyOid },
    });
    if (taken) throw new Error("Company slug is already in use.");
    updates.slug = slug;
  }

  await db.collection<CompanyDocument>(COLLECTIONS.companies).updateOne(
    { _id: companyOid },
    { $set: updates },
  );

  const doc = await db.collection<CompanyDocument>(COLLECTIONS.companies).findOne({ _id: companyOid });
  if (!doc) return null;

  await writePlatformAuditLog({
    actorEmail: actor.email,
    actorName: actor.name,
    action: "company.updated",
    resourceType: "company",
    resourceId: id,
    companyId: id,
    metadata: patch,
  });

  return companyDocToDTO(doc);
}

export type TenantAdminListItem = {
  id: string;
  email: string;
  name: string;
  companyId: string;
  companyName: string;
  isActive: boolean;
  createdAt?: string;
};

export async function listTenantAdminsForPlatform(opts?: {
  search?: string;
  companyId?: string;
}): Promise<TenantAdminListItem[]> {
  const db = await getDb();
  if (!db) return [];

  const filter: Record<string, unknown> = { appRole: "admin" };
  if (opts?.companyId && ObjectId.isValid(opts.companyId)) {
    filter.companyId = new ObjectId(opts.companyId);
  }

  const rows = await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  const companies = new Map((await listCompanies()).map((c) => [c.id, c.name]));
  const search = opts?.search?.trim().toLowerCase() ?? "";

  return rows
    .map((row) => ({
      id: row._id.toHexString(),
      email: row.email,
      name: row.name,
      companyId: row.companyId.toHexString(),
      companyName: companies.get(row.companyId.toHexString()) ?? "Unknown",
      isActive: row.isActive !== false,
      createdAt: row.createdAt?.toISOString(),
    }))
    .filter((row) => {
      if (!search) return true;
      return (
        row.email.toLowerCase().includes(search) ||
        row.name.toLowerCase().includes(search) ||
        row.companyName.toLowerCase().includes(search)
      );
    });
}

export async function setTenantAdminActive(
  adminId: string,
  isActive: boolean,
  actor: { email: string; name: string },
): Promise<boolean> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(adminId)) return false;

  const result = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).updateOne(
    { _id: new ObjectId(adminId), appRole: "admin" },
    { $set: { isActive, updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) return false;

  await writePlatformAuditLog({
    actorEmail: actor.email,
    actorName: actor.name,
    action: isActive ? "tenant_admin.enabled" : "tenant_admin.disabled",
    resourceType: "tenant_admin",
    resourceId: adminId,
  });

  return true;
}

export async function createTenantAdminForCompany(input: {
  companyId: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}) {
  const company = await getCompanyById(input.companyId);
  if (!company) throw new Error("Company not found.");

  const db = await getDb();
  if (!db) {
    throw new Error("MongoDB is not available.");
  }

  const adminEmail = input.adminEmail.toLowerCase().trim();
  const adminName = input.adminName.trim();
  if (!adminName) throw new Error("Admin name is required.");
  if (input.adminPassword.length < 8) {
    throw new Error("Admin password must be at least 8 characters.");
  }

  const companyOid = toCompanyObjectId(company.id);
  const appUsersCol = db.collection<AppUserDocument>(COLLECTIONS.appUsers);
  const existingUser = await appUsersCol.findOne({ email: adminEmail });
  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  await ensureRolesSeedForCompany(db, company.id);

  const now = new Date();
  const employeeId = `ADM-${Date.now().toString(36).toUpperCase()}`;
  await db.collection<EmployeeDocument>(COLLECTIONS.employees).insertOne({
    _id: new ObjectId(),
    companyId: companyOid,
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
    companyId: companyOid,
    email: adminEmail,
    passwordHash: await bcrypt.hash(input.adminPassword, 10),
    name: adminName,
    appRole: "admin",
    employeeId,
    imageUrl: "",
    isProfileCompleted: true,
    isActive: true,
    updatedProfileAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: adminUserId.toHexString(),
    email: adminEmail,
    name: adminName,
    appRole: "admin" as const,
    companyId: company.id,
  };
}

export async function getPlatformDashboardStats() {
  const companies = await listCompaniesForPlatform();
  const active = companies.filter((c) => c.status === "active").length;
  const inactive = companies.filter((c) => c.status === "inactive").length;
  const tenantAdmins = await listTenantAdminsForPlatform();

  return {
    totalCompanies: companies.length,
    activeCompanies: active,
    inactiveCompanies: inactive,
    totalTenantAdmins: tenantAdmins.length,
    recentCompanies: [...companies]
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 5),
    recentTenantAdmins: tenantAdmins.slice(0, 5),
  };
}
