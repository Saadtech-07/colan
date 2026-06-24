import type { ObjectId } from "mongodb";
import type { DailyUpdate } from "@/types";
import { COLLECTIONS } from "./collections";

export const DAILY_UPDATE_COLLECTION = COLLECTIONS.dailyUpdates;

export type DailyUpdateDocument = {
  _id: ObjectId;
  employeeId: string;
  employeeName: string;
  projectId: string;
  date: string;
  workDone: string;
  blockers: string;
  tomorrowPlan: string;
  createdAt: Date;
};

export function dailyUpdateDocToDTO(
  doc: DailyUpdateDocument,
  extras?: { projectName?: string },
): DailyUpdate {
  return {
    id: doc._id.toHexString(),
    employeeId: doc.employeeId,
    employeeName: doc.employeeName,
    projectId: doc.projectId,
    projectName: extras?.projectName,
    date: doc.date,
    workDone: doc.workDone,
    blockers: doc.blockers,
    tomorrowPlan: doc.tomorrowPlan,
    createdAt: doc.createdAt.toISOString(),
  };
}
