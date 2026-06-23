"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import {
  AppUserAccountDetailsStep,
  AppUserWorkspaceDetailsStep,
  buildDefaultAppUserForm,
  type AppUserAccountFormValues,
} from "@/components/features/app-user-account-form-fields";
import { AppUserFormStepper, type AppUserFormStep } from "@/components/features/app-user-form-stepper";
import {
  validateCreateAppUserAccountStep,
  validateCreateAppUserWorkEmailStep,
  type AccountSetupForm,
} from "@/components/features/create-app-user-wizard-dialog";
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
  createAccountToastFromResult,
  createAppUserAccount,
  stashCreateAccountToast,
} from "@/lib/create-app-user-client";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import type { TeamName } from "@/types";
import type { AppUserPublicDTO } from "@/models/app-user.model";

const APP_USER_SHEET_OVERLAY =
  "bg-black/50 backdrop-blur-none data-[state=open]:opacity-100 data-[state=closed]:opacity-0";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateAppUserSheet({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { teamNames, workspaceRoles, employees, refreshData } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();

  const defaultTeam = (teamNames[0] ?? "React Team") as TeamName;
  const submitting = isLoadingKey("app-users-submit");

  const [users, setUsers] = React.useState<AppUserPublicDTO[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<AppUserFormStep>("account");
  const [account, setAccount] = React.useState<AppUserAccountFormValues>(() =>
    buildDefaultAppUserForm(defaultTeam),
  );

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void fetch("/api/app-users", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return [];
        return (await res.json()) as AppUserPublicDTO[];
      })
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const resetForm = React.useCallback(() => {
    setError(null);
    setStep("account");
    setAccount(buildDefaultAppUserForm(defaultTeam));
  }, [defaultTeam]);

  React.useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !submitting) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const patchAccount = (patch: Partial<AppUserAccountFormValues>) => {
    setAccount((prev) => ({ ...prev, ...patch }));
  };

  const continueToWorkspace = () => {
    setError(null);
    const validationError = validateCreateAppUserAccountStep(account, users, employees);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep("workspace");
  };

  const handleCreate = async () => {
    setError(null);
    const accountError = validateCreateAppUserAccountStep(account, users, employees);
    if (accountError) {
      setError(accountError);
      setStep("account");
      return;
    }

    const workEmailError = validateCreateAppUserWorkEmailStep(account, users);
    if (workEmailError) {
      setError(workEmailError);
      setStep("workspace");
      return;
    }

    const payload: AccountSetupForm = {
      ...account,
      personalEmail: account.personalEmail.trim().toLowerCase(),
      workEmail: account.workEmail.trim().toLowerCase(),
      email: account.workEmail.trim().toLowerCase(),
    };

    try {
      await withLoading("app-users-submit", LOADING_PRESETS.creatingAccount, async () => {
        const result = await createAppUserAccount(payload);
        await refreshData();
        stashCreateAccountToast(createAccountToastFromResult(result));
        resetForm();
        onOpenChange(false);
        router.push("/app-users");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create account.");
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
            variant="muted"
            className="w-fit rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            New workspace account
          </Badge>
          <div className="space-y-2 text-left">
            <SheetTitle>Create account</SheetTitle>
            <SheetDescription>
              Account access first, then workspace and address details.
            </SheetDescription>
          </div>
          <AppUserFormStepper step={step} mode="create" />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {step === "account" ? (
            <AppUserAccountDetailsStep
              values={account}
              onChange={patchAccount}
              mode="create"
              workspaceRoles={workspaceRoles}
              teamNames={teamNames}
              defaultTeam={defaultTeam}
              employees={employees}
              disabled={submitting}
            />
          ) : (
            <AppUserWorkspaceDetailsStep
              values={account}
              onChange={patchAccount}
              mode="create"
              workspaceRoles={workspaceRoles}
              teamNames={teamNames}
              defaultTeam={defaultTeam}
              employees={employees}
              disabled={submitting}
            />
          )}
        </div>

        <SheetFooter className="flex-col gap-3 border-t border-border/60 bg-background/95 px-6 py-4 sm:flex-col sm:justify-start">
          <p className="w-full text-xs leading-5 text-muted-foreground">
            {step === "account"
              ? "Save account details to continue to workspace information."
              : "Workspace details sync to the linked team member profile."}
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
              disabled={submitting}
            >
              {step === "workspace" ? "Back" : "Cancel"}
            </Button>
            {step === "account" ? (
              <Button
                type="button"
                className="h-11 flex-1 rounded-2xl px-5 shadow-sm"
                onClick={continueToWorkspace}
                disabled={submitting}
              >
                Save &amp; continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 flex-1 rounded-2xl px-5 shadow-sm"
                onClick={() => void handleCreate()}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create account
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
