import {
  UNASSIGNED_SEAT,
  type AppUserAccountFormValues,
} from "@/components/features/app-user-account-form-fields";
import { roleNeedsEmployeeIdentity } from "@/lib/permissions";
import { parseApiError } from "@/providers/app-state";

export const APP_USER_EDIT_SUCCESS_KEY = "app-user-edit-success";

export function buildUpdateAppUserBody(values: AppUserAccountFormValues) {
  const showEmployeeIdentity = roleNeedsEmployeeIdentity(values.appRole);

  return {
    name: values.name.trim(),
    appRole: values.appRole,
    employeeId: values.employeeId.trim(),
    ...(showEmployeeIdentity
      ? {
          team: values.team,
          bayNumber:
            values.bayNumber && values.bayNumber !== UNASSIGNED_SEAT
              ? values.bayNumber
              : UNASSIGNED_SEAT,
        }
      : {}),
    workEmail: values.workEmail.trim() || values.email.trim(),
    personalEmail: values.personalEmail.trim() || undefined,
    phone: values.phone.trim() || undefined,
    currentAddress: values.currentAddress.trim() || undefined,
    permanentAddress: values.permanentAddress.trim() || undefined,
    joinedDate: values.joinedDate.trim() || undefined,
    gender: values.gender,
    imageUrl: values.imageUrl.trim(),
    ...(values.password ? { password: values.password } : {}),
  };
}

export async function updateAppUserAccount(
  id: string,
  values: AppUserAccountFormValues,
) {
  const res = await fetch(`/api/app-users/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildUpdateAppUserBody(values)),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return res.json();
}

export function stashEditAccountSuccess(
  message = "Account updated successfully.",
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(APP_USER_EDIT_SUCCESS_KEY, message);
}

export function consumeEditAccountSuccess(): string | null {
  if (typeof window === "undefined") return null;
  const message = sessionStorage.getItem(APP_USER_EDIT_SUCCESS_KEY);
  if (!message) return null;
  sessionStorage.removeItem(APP_USER_EDIT_SUCCESS_KEY);
  return message;
}
