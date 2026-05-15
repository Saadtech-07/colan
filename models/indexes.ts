import type { Db } from "mongodb";
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

/**
 * Idempotent index setup for Colan collections. Safe to call on each request
 * (MongoDB no-ops if index already exists with same options).
 */
export async function ensureColanModelIndexes(db: Db): Promise<void> {
  await db
    .collection<AppUserDocument>(COLLECTIONS.appUsers)
    .createIndex({ email: 1 }, { unique: true });

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
  await db.collection<ProjectDocument>(COLLECTIONS.projects).createIndex({ team: 1, assignedDate: -1 });

  await db.collection<GalleryImageDocument>(COLLECTIONS.gallery).createIndex({ uploadedAt: -1 });
}
