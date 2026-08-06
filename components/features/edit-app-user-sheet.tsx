"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Save } from "lucide-react";
import {
  AppUserAccountDetailsStep,
  AppUserWorkspaceDetailsStep,
  buildFormFromAppUserRecord,
  type AppUserAccountFormValues,
} from "@/components/features/app-user-account-form-fields";
import { AppUserFormStepper, type AppUserFormStep } from "@/components/features/app-user-form-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  stashEditAccountSuccess,
  updateAppUserAccount,
} from "@/lib/edit-app-user-client";
import { fetchAppUsersList, clearCachedAppUsers } from "@/lib/app-users-client";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { roleNeedsEmployeeIdentity } from "@/lib/permissions";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import type { AppUserPublicDTO } from "@/models/app-user.model";
import type { Employee, TeamName } from "@/types";

const APP_USER_SHEET_OVERLAY =
  "bg-black/50 backdrop-blur-none data-[state=open]:opacity-100 data-[state=closed]:opacity-0";

type Props = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function findLinkedEmployeeId(
  userRecord: AppUserPublicDTO,
  employees: Employee[],
) {
  const email = userRecord.email.toLowerCase();
  return employees.find(
    (employee) =>
      employee.directory?.workEmail?.toLowerCase() === email ||
      employee.employeeId.toLowerCase() === userRecord.employeeId?.toLowerCase(),
  )?.id;
}

function validateEditAccountStep(values: AppUserAccountFormValues): string | null {
  if (!values.email || !values.name.trim()) {
    return "Email and name are required.";
  }
  if (!values.employeeId.trim()) return "User ID is required.";
  if (roleNeedsEmployeeIdentity(values.appRole) && !values.team.trim()) {
    return "Team is required for this role.";
  }
  if (values.password.trim() && values.password.trim().length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}

export function EditAppUserSheet({ userId, open, onOpenChange }: Props) {
  const router = useRouter();
  const { teamNames, workspaceRoles, employees, refreshData } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();

  const defaultTeam = (teamNames[0] ?? "React Team") as TeamName;
  const submitting = isLoadingKey("app-users-submit");

  const [loadingUser, setLoadingUser] = React.useState(false);
  const [values, setValues] = React.useState<AppUserAccountFormValues | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<AppUserFormStep>("account");

  const resetState = React.useCallback(() => {
    setValues(null);
    setEditingEmployeeId(undefined);
    setError(null);
    setStep("account");
    setLoadingUser(false);
  }, []);

  React.useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    let cancelled = false;
    setLoadingUser(true);
    setError(null);
    setStep("account");

    void fetchAppUsersList()
      .then((users) => {
        if (cancelled) return;
        const userRecord = users.find((user) => user.id === userId);
        if (!userRecord) {
          onOpenChange(false);
          router.replace("/app-users");
          return;
        }

        setEditingEmployeeId(findLinkedEmployeeId(userRecord, employees));
        setValues(
          buildFormFromAppUserRecord({
            email: userRecord.email,
            name: userRecord.name,
            employeeId: userRecord.employeeId,
            appRole: userRecord.appRole,
            team: userRecord.team,
            defaultTeam,
            workEmail: userRecord.workEmail,
            personalEmail: userRecord.personalEmail,
            phone: userRecord.phone,
            location: userRecord.location,
            fullAddress: userRecord.fullAddress,
            currentAddress: userRecord.currentAddress,
            permanentAddress: userRecord.permanentAddress,
            joinedDate: userRecord.joinedDate,
            bayNumber: userRecord.bayNumber,
            gender: (userRecord.gender as AppUserAccountFormValues["gender"]) ?? "male",
            imageUrl: userRecord.imageUrl,
          }),
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load account.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUser(false);
      });

    return () => {
      cancelled = true;
    };
  }, [defaultTeam, employees, onOpenChange, open, router, userId]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !submitting) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const patchValues = (patch: Partial<AppUserAccountFormValues>) => {
    setValues((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const continueToWorkspace = () => {
    if (!values) return;
    setError(null);
    const validationError = validateEditAccountStep(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep("workspace");
  };

  const handleSave = async () => {
    if (!values) return;

    setError(null);
    const accountError = validateEditAccountStep(values);
    if (accountError) {
      setError(accountError);
      setStep("account");
      return;
    }

    try {
      await withLoading("app-users-submit", LOADING_PRESETS.updatingAccount, async () => {
        await updateAppUserAccount(userId, values);
        stashEditAccountSuccess();
        clearCachedAppUsers();
        resetState();
        onOpenChange(false);
        router.push("/app-users");
        // Refresh workspace data in the background — don't block navigation.
        void refreshData();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save account.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        overlayClassName={APP_USER_SHEET_OVERLAY}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(100vw-2rem,32rem)]"
      >
        <SheetHeader className="space-y-4 border-b border-border/60 px-6 py-5 pr-14">
          <Badge
            variant="warning"
            className="w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
          >
            Editing account
          </Badge>
          <div className="space-y-2 text-left">
            <SheetTitle>Edit account</SheetTitle>
            <SheetDescription>
              Login access on step one; workspace and addresses on step two.
            </SheetDescription>
          </div>
          <AppUserFormStepper step={step} mode="edit" />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loadingUser || !values ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : step === "account" ? (
            <AppUserAccountDetailsStep
              values={values}
              onChange={patchValues}
              mode="edit"
              workspaceRoles={workspaceRoles}
              teamNames={teamNames}
              defaultTeam={defaultTeam}
              employees={employees}
              disabled={submitting}
            />
          ) : (
            <AppUserWorkspaceDetailsStep
              values={values}
              onChange={patchValues}
              mode="edit"
              workspaceRoles={workspaceRoles}
              teamNames={teamNames}
              defaultTeam={defaultTeam}
              employees={employees}
              editingEmployeeId={editingEmployeeId}
              disabled={submitting}
            />
          )}
        </div>

        <SheetFooter className="flex-col gap-3 border-t border-border/60 bg-background/95 px-6 py-4 sm:flex-col sm:justify-start">
          <p className="w-full text-xs leading-5 text-muted-foreground">
            {step === "account"
              ? "Save account details to continue to workspace information."
              : "Changes apply to the login account and linked team member profile."}
          </p>
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-2xl border-border/70 bg-background/80"
              onClick={() => {
                if (step === "workspace") {
                  setStep("account");
                  setError(null);
                  return;
                }
                handleOpenChange(false);
              }}
              disabled={submitting || loadingUser}
            >
              {step === "workspace" ? "Back" : "Cancel"}
            </Button>
            {step === "account" ? (
              <Button
                type="button"
                className="h-11 flex-1 rounded-2xl px-5 shadow-sm"
                onClick={continueToWorkspace}
                disabled={submitting || loadingUser || !values}
              >
                Save &amp; continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 flex-1 rounded-2xl px-5 shadow-sm"
                disabled={submitting || loadingUser || !values}
                onClick={() => void handleSave()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
