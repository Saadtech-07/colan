import type { Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";
import type { AppUserDocument } from "./app-user.model";
import type { EmployeeDocument } from "./employee.model";
import type { EmployeeDetailsDocument } from "./employee-details.model";
import type { TeamDocument } from "./team.model";
import type { CompanyRoleDocument } from "./company-role.model";
import type { SeatingBayDocument } from "./seating-bay.model";
import type { SeatingAssignmentDocument } from "./seating-assignment.model";
import type { TeamMemberDocument } from "./team-member.model";
import type { ProjectDocument } from "./project.model";
import type { GalleryImageDocument } from "./gallery-image.model";

async function removeDuplicateEmployeeIds(db: Db): Promise<void> {
  const collection = db.collection<EmployeeDocument>(COLLECTIONS.employees);
  const duplicates = await collection
    .aggregate<{ _id: string; ids: ObjectId[] }>([
      { $match: { employeeId: { $type: "string" } } },
      {
        $group: {
          _id: "$employeeId",
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  for (const dup of duplicates) {
    const sortedIds = dup.ids.slice().sort((a, b) =>
      a.toHexString().localeCompare(b.toHexString()),
    );
    const [, ...remove] = sortedIds;
    if (remove.length === 0) continue;
    await collection.deleteMany({ _id: { $in: remove } });
  }
}

async function removeInvalidCompanyRoleKeys(db: Db): Promise<void> {
  const collection = db.collection<CompanyRoleDocument>(COLLECTIONS.companyRoles);

  await collection.deleteMany({
    $or: [
      { key: { $exists: false } },
      { key: { $type: 10 } }, // BSON null — invalid legacy rows before unique index
    ],
  });

  const duplicates = await collection
    .aggregate<{ _id: string; ids: ObjectId[] }>([
      { $match: { key: { $type: "string" } } },
      {
        $group: {
          _id: "$key",
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  for (const dup of duplicates) {
    const sortedIds = dup.ids.slice().sort((a, b) =>
      a.toHexString().localeCompare(b.toHexString()),
    );
    const [, ...remove] = sortedIds;
    if (remove.length === 0) continue;
    await collection.deleteMany({ _id: { $in: remove } });
  }
}

/**
 * Idempotent index setup for Colan collections. Safe to call on each request
 * (MongoDB no-ops if index already exists with same options).
 */
export async function ensureColanModelIndexes(db: Db): Promise<void> {
  await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .createIndex({ email: 1 }, { unique: true });

  await removeDuplicateEmployeeIds(db);
  await db
    .collection<EmployeeDocument>(COLLECTIONS.employees)
    .createIndex({ employeeId: 1 }, { unique: true });
  await db.collection<EmployeeDocument>(COLLECTIONS.employees).createIndex({ bayNumber: 1 });
  await db.collection<EmployeeDocument>(COLLECTIONS.employees).createIndex({ team: 1, name: 1 });

  await db
    .collection<EmployeeDetailsDocument>(COLLECTIONS.employeeDetails)
    .createIndex({ employeeRef: 1 }, { unique: true });

  await db
    .collection<TeamDocument>(COLLECTIONS.teams)
    .createIndex({ name: 1 }, { unique: true });
  await db.collection<TeamDocument>(COLLECTIONS.teams).createIndex({ slug: 1 }, { unique: true });

  await removeInvalidCompanyRoleKeys(db);
  await db
    .collection<CompanyRoleDocument>(COLLECTIONS.companyRoles)
    .createIndex({ key: 1 }, { unique: true });

  await db
    .collection<SeatingBayDocument>(COLLECTIONS.seatingBays)
    .createIndex({ bayId: 1 }, { unique: true });

  await db
    .collection<SeatingAssignmentDocument>(COLLECTIONS.seatingAssignments)
    .createIndex({ bayId: 1, assignedAt: -1 });

  await db
    .collection<TeamMemberDocument>(COLLECTIONS.teamMembers)
    .createIndex({ appUserEmail: 1 }, { unique: true });
  await db.collection<TeamMemberDocument>(COLLECTIONS.teamMembers).createIndex({ employeeRef: 1 });

  await db
    .collection<ProjectDocument>(COLLECTIONS.projects)
    .createIndex({ slug: 1 }, { unique: true });
  await db.collection<ProjectDocument>(COLLECTIONS.projects).createIndex({
    teams: 1,
    assignedDate: -1,
  });

  await db.collection<GalleryImageDocument>(COLLECTIONS.gallery).createIndex({ uploadedAt: -1 });

  await db
    .collection(COLLECTIONS.passwordResetTokens)
    .createIndex({ tokenHash: 1 }, { unique: true });
  await db
    .collection(COLLECTIONS.passwordResetTokens)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection(COLLECTIONS.passwordResetTokens).createIndex({ email: 1 });
}
