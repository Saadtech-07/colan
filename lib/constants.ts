import type { CompanyRole, TeamName } from "@/types";

export const TEAMS: TeamName[] = [
  "React Team",
  "Next.js Team",
  "Node Team",
  "UI/UX Team",
  "Testing Team",
  "DevOps Team",
];

export const COMPANY_ROLES: CompanyRole[] = [
  "Admin",
  "Manager",
  "Team Lead",
  "Employee",
  "Intern",
];

export const BAY_PREFIX = "E";

/** E-01 … E-100 */
export function bayId(index: number): string {
  const n = Math.min(100, Math.max(1, index));
  return `${BAY_PREFIX}-${String(n).padStart(2, "0")}`;
}

export const ALL_BAY_IDS: string[] = Array.from({ length: 100 }, (_, i) =>
  bayId(i + 1),
);
