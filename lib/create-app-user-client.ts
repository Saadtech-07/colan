import { UNASSIGNED_SEAT } from "@/components/features/app-user-account-form-fields";
import type { AccountSetupForm } from "@/components/features/create-app-user-wizard-dialog";
import { roleNeedsEmployeeIdentity } from "@/lib/permissions";
import { parseApiError } from "@/providers/app-state";

export type CreateAccountToastPayload = {
  variant: "success" | "warning";
  title: string;
  description: string;
};

export type AppUserMutationResponse = {
  emailDelivery?: {
    attempted: boolean;
    sent: boolean;
    provider: "nodemailer";
    message?: string;
    id?: string;
  };
};

export const APP_USER_CREATE_TOAST_KEY = "app-user-create-toast";

export function buildCreateAppUserBody(account: AccountSetupForm) {
  const workEmail = account.workEmail.trim().toLowerCase();
  const personalEmail = account.personalEmail.trim().toLowerCase();

  return {
    email: workEmail,
    personalEmail,
    name: account.name.trim(),
    appRole: account.appRole,
    ...(roleNeedsEmployeeIdentity(account.appRole)
      ? {
          employeeId: account.employeeId.trim(),
          team: account.team,
        }
      : {}),
    password: account.password.trim(),
    ...(account.imageUrl.trim() ? { imageUrl: account.imageUrl.trim() } : {}),
    workEmail,
    phone: account.phone.trim() || undefined,
    currentAddress: account.currentAddress.trim() || undefined,
    permanentAddress: account.permanentAddress.trim() || undefined,
    joinedDate: account.joinedDate.trim() || undefined,
    gender: account.gender,
    bayNumber:
      account.bayNumber && account.bayNumber !== UNASSIGNED_SEAT
        ? account.bayNumber
        : undefined,
  };
}

export async function createAppUserAccount(
  account: AccountSetupForm,
): Promise<AppUserMutationResponse> {
  const res = await fetch("/api/app-users", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildCreateAppUserBody(account)),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return (await res.json()) as AppUserMutationResponse;
}

export function createAccountToastFromResult(
  result: AppUserMutationResponse,
): CreateAccountToastPayload {
  if (result.emailDelivery?.sent) {
    return {
      variant: "success",
      title: "Employee account created successfully",
      description: "Login credentials email sent to personal email.",
    };
  }

  return {
    variant: "warning",
    title: "Employee created but email could not be sent",
    description:
      result.emailDelivery?.message ||
      "Check the email configuration and resend the credentials manually.",
  };
}

export function stashCreateAccountToast(toast: CreateAccountToastPayload) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(APP_USER_CREATE_TOAST_KEY, JSON.stringify(toast));
}

export function consumeCreateAccountToast(): CreateAccountToastPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(APP_USER_CREATE_TOAST_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(APP_USER_CREATE_TOAST_KEY);
  try {
    return JSON.parse(raw) as CreateAccountToastPayload;
  } catch {
    return null;
  }
}
