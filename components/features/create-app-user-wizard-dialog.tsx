import type { AppUserAccountFormValues } from "@/components/features/app-user-account-form-fields";
import { roleNeedsEmployeeIdentity } from "@/lib/permissions";
import type { AppUserPublicDTO } from "@/models/app-user.model";
import type { Employee } from "@/types";

export type AccountSetupForm = AppUserAccountFormValues;

export function validateCreateAppUserAccountStep(
  account: AppUserAccountFormValues,
  users: AppUserPublicDTO[],
  employees: Employee[],
): string | null {
  const personalEmail = account.personalEmail.trim().toLowerCase();
  const needsIdentity = roleNeedsEmployeeIdentity(account.appRole);
  const userId = account.employeeId.trim();

  if (!personalEmail) return "Personal email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
    return "Enter a valid personal email address.";
  }

  if (!account.name.trim()) return "Full name is required.";

  if (!userId) return "User ID is required.";
  const userIdLower = userId.toLowerCase();
  if (
    users.some((user) => user.employeeId?.trim().toLowerCase() === userIdLower) ||
    employees.some((employee) => employee.employeeId.trim().toLowerCase() === userIdLower)
  ) {
    return "This user ID is already in use.";
  }

  if (needsIdentity && !account.team.trim()) return "Team is required.";

  if (!account.appRole.trim()) return "Role is required.";
  if (!account.password.trim()) return "Password is required.";
  if (account.password.trim().length < 6) {
    return "Password must be at least 6 characters.";
  }

  return null;
}

export function validateCreateAppUserWorkEmailStep(
  account: AppUserAccountFormValues,
  users: AppUserPublicDTO[],
): string | null {
  const workEmail = account.workEmail.trim().toLowerCase();
  if (!workEmail) return "Work email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    return "Enter a valid work email address.";
  }
  if (users.some((user) => user.email.toLowerCase() === workEmail)) {
    return "An account with this work email already exists.";
  }
  return null;
}
