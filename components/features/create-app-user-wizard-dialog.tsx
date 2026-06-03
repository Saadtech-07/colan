"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import {
  AppUserAccountFormFields,
  UNASSIGNED_SEAT,
  applyAppUserRole,
  buildDefaultAppUserForm,
  type AppUserAccountFormValues,
} from "@/components/features/app-user-account-form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { roleNeedsEmployeeIdentity } from "@/lib/permissions";
import type { AppRole, Employee, TeamName } from "@/types";
import type { AppUserPublicDTO } from "@/models/app-user.model";
import type { WorkspaceRole } from "@/models";

export type AccountSetupForm = AppUserAccountFormValues;

export type EmployeeProfileForm = never;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTeam: TeamName;
  teamNames: string[];
  workspaceRoles: WorkspaceRole[];
  users: AppUserPublicDTO[];
  employees: Employee[];
  submitting: boolean;
  onSubmit: (account: AppUserAccountFormValues) => Promise<void>;
};

function validateCreateForm(
  account: AppUserAccountFormValues,
  users: AppUserPublicDTO[],
  employees: Employee[],
): string | null {
  const email = account.email.trim().toLowerCase();
  const needsIdentity = roleNeedsEmployeeIdentity(account.appRole);
  const employeeId = account.employeeId.trim();

  if (!email) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  if (users.some((user) => user.email.toLowerCase() === email)) {
    return "An account with this email already exists.";
  }

  if (!account.name.trim()) return "Full name is required.";

  if (needsIdentity) {
    if (!employeeId) return "Employee ID is required.";
    const employeeIdLower = employeeId.toLowerCase();
    if (
      users.some((user) => user.employeeId?.trim().toLowerCase() === employeeIdLower) ||
      employees.some((employee) => employee.employeeId.trim().toLowerCase() === employeeIdLower)
    ) {
      return "This employee ID is already in use.";
    }

    if (!account.team.trim()) return "Team is required.";
  }

  if (!account.appRole.trim()) return "Role is required.";

  if (!account.password.trim()) return "Password is required.";
  if (account.password.trim().length < 6) {
    return "Password must be at least 6 characters.";
  }

  return null;
}

export function CreateAppUserWizardDialog({
  open,
  onOpenChange,
  defaultTeam,
  teamNames,
  workspaceRoles,
  users,
  employees,
  submitting,
  onSubmit,
}: Props) {
  const [error, setError] = React.useState<string | null>(null);
  const [account, setAccount] = React.useState<AppUserAccountFormValues>(() =>
    buildDefaultAppUserForm(defaultTeam),
  );

  const resetForm = React.useCallback(() => {
    setError(null);
    setAccount(buildDefaultAppUserForm(defaultTeam));
  }, [defaultTeam]);

  React.useEffect(() => {
    if (!open) return;
    resetForm();
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

  const handleCreate = async () => {
    setError(null);
    const validationError = validateCreateForm(account, users, employees);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await onSubmit({
        ...account,
        email: account.email.trim().toLowerCase(),
        workEmail: account.workEmail.trim() || account.email.trim().toLowerCase(),
      });
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create account.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(100vw-2rem,56rem)] max-w-none flex-col overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:rounded-[28px]">
        <DialogHeader className="shrink-0 space-y-3 border-b border-border/60 px-6 py-5">
          <Badge
            variant="muted"
            className="w-fit rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            New workspace account
          </Badge>
          <div>
            <DialogTitle className="text-xl">Create account</DialogTitle>
            <DialogDescription className="mt-1">
              Set up login access and complete all employee account details in one place.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <AppUserAccountFormFields
            values={account}
            onChange={patchAccount}
            mode="create"
            workspaceRoles={workspaceRoles}
            teamNames={teamNames}
            defaultTeam={defaultTeam}
            employees={employees}
            disabled={submitting}
          />
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">
            Account details sync to the linked team member profile automatically.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-border/70 bg-background/80"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 rounded-2xl px-5 shadow-sm"
              onClick={() => void handleCreate()}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Account
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { UNASSIGNED_SEAT, applyAppUserRole, buildDefaultAppUserForm };
