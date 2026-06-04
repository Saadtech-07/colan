"use client";

import * as React from "react";
import { MapPin } from "lucide-react";
import { AvatarUploadField } from "@/components/features/avatar-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ALL_SEAT_IDS } from "@/lib/seating-layout";
import { addressesFromDirectory, directoryPatchFromAddresses } from "@/lib/employee-address";
import { seatOccupancyMap } from "@/lib/seating-utils";
import { generateTemporaryPassword } from "@/lib/password-utils";
import { roleNeedsEmployeeIdentity } from "@/lib/permissions";
import type { AppRole, Employee, TeamName } from "@/types";
import type { WorkspaceRole } from "@/models";

export const UNASSIGNED_SEAT = "__unassigned__";

export type AppUserAccountFormValues = {
  email: string;
  name: string;
  password: string;
  employeeId: string;
  appRole: AppRole;
  team: TeamName;
  workEmail: string;
  phone: string;
  currentAddress: string;
  permanentAddress: string;
  joinedDate: string;
  bayNumber: string;
  imageUrl: string;
};

export function buildDefaultAppUserForm(defaultTeam: TeamName): AppUserAccountFormValues {
  return {
    email: "",
    name: "",
    password: generateTemporaryPassword(),
    employeeId: "",
    appRole: "employee",
    team: defaultTeam,
    workEmail: "",
    phone: "",
    currentAddress: "",
    permanentAddress: "",
    joinedDate: new Date().toISOString().split("T")[0],
    bayNumber: UNASSIGNED_SEAT,
    imageUrl: "",
  };
}

export function applyAppUserRole(
  prev: AppUserAccountFormValues,
  appRole: AppRole,
  defaultTeam: TeamName,
): Partial<AppUserAccountFormValues> {
  if (!roleNeedsEmployeeIdentity(appRole)) {
    return {
      appRole,
      employeeId: "",
      team: defaultTeam,
      bayNumber: UNASSIGNED_SEAT,
    };
  }
  return { appRole };
}

export function buildFormFromAppUserRecord(args: {
  email: string;
  name: string;
  employeeId?: string;
  appRole: AppRole;
  team?: TeamName;
  defaultTeam: TeamName;
  workEmail?: string;
  phone?: string;
  location?: string;
  /** @deprecated Legacy; mapped into currentAddress when loading. */
  fullAddress?: string;
  currentAddress?: string;
  permanentAddress?: string;
  joinedDate?: string;
  bayNumber?: string;
  imageUrl?: string;
}): AppUserAccountFormValues {
  const addresses = addressesFromDirectory({
    location: args.location,
    fullAddress: args.fullAddress,
    currentAddress: args.currentAddress,
    permanentAddress: args.permanentAddress,
  });

  return {
    email: args.email,
    name: args.name,
    password: "",
    employeeId: args.employeeId ?? "",
    appRole: args.appRole,
    team: args.team ?? args.defaultTeam,
    workEmail: args.workEmail ?? args.email,
    phone: args.phone ?? "",
    ...addresses,
    joinedDate: args.joinedDate ?? new Date().toISOString().split("T")[0],
    bayNumber: args.bayNumber?.trim() || UNASSIGNED_SEAT,
    imageUrl: args.imageUrl ?? "",
  };
}

export function directoryFieldsFromForm(
  values: AppUserAccountFormValues,
): ReturnType<typeof directoryPatchFromAddresses> {
  return directoryPatchFromAddresses(
    {
      currentAddress: values.currentAddress,
      permanentAddress: values.permanentAddress,
    },
    {
      workEmail: values.workEmail.trim() || values.email.trim().toLowerCase(),
      phone: values.phone.trim() || undefined,
      joinedDate: values.joinedDate.trim() || undefined,
    },
  );
}

type StepProps = {
  values: AppUserAccountFormValues;
  onChange: (patch: Partial<AppUserAccountFormValues>) => void;
  mode: "create" | "edit";
  workspaceRoles: WorkspaceRole[];
  teamNames: TeamName[];
  defaultTeam: TeamName;
  employees: Employee[];
  editingEmployeeId?: string;
  disabled?: boolean;
};

export function AppUserAccountDetailsStep({
  values,
  onChange,
  mode,
  workspaceRoles,
  teamNames,
  defaultTeam,
  disabled,
}: StepProps) {
  const showEmployeeIdentityFields = roleNeedsEmployeeIdentity(values.appRole);

  return (
    <section className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Login identity, workspace role, and password.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="account-email">
            Email
            {mode === "create" ? (
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            ) : null}
          </Label>
          <Input
            id="account-email"
            type="email"
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
            disabled={disabled || mode === "edit"}
            placeholder="name@colan.io"
            className="h-11 rounded-2xl border-border/70 disabled:opacity-60"
          />
          {mode === "edit" ? (
            <p className="text-xs text-muted-foreground">
              Email remains fixed after account creation.
            </p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="account-name">
            Name
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Input
            id="account-name"
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            disabled={disabled}
            placeholder="Full name"
            className="h-11 rounded-2xl border-border/70"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-employee-id">
            Employee ID
            {showEmployeeIdentityFields ? (
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            ) : null}
          </Label>
          <Input
            id="account-employee-id"
            value={values.employeeId}
            onChange={(e) => onChange({ employeeId: e.target.value })}
            disabled={disabled || !showEmployeeIdentityFields}
            placeholder={showEmployeeIdentityFields ? "COL-1001" : "Not required for this role"}
            className="h-11 rounded-2xl border-border/70 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="space-y-2">
          <Label>
            Role
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Select
            value={values.appRole}
            onValueChange={(value) =>
              onChange(applyAppUserRole(values, value as AppRole, defaultTeam))
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85">
              <SelectValue>
                {workspaceRoles.find((role) => role.key === values.appRole)?.name ??
                  values.appRole}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/60">
              {workspaceRoles.map((role) => (
                <SelectItem key={role.key} value={role.key}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>
            Team
            {showEmployeeIdentityFields ? (
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            ) : null}
          </Label>
          <Select
            value={values.team}
            onValueChange={(value) => onChange({ team: value as TeamName })}
            disabled={disabled || !showEmployeeIdentityFields}
          >
            <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85 disabled:cursor-not-allowed disabled:opacity-60">
              <SelectValue>
                {showEmployeeIdentityFields ? values.team : "Not required for this role"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/60">
              {teamNames.map((team) => (
                <SelectItem key={team} value={team}>
                  {team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Security
            </p>
            <h4 className="mt-1 text-sm font-semibold text-foreground">
              Password
              {mode === "create" ? (
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              ) : null}
            </h4>
          </div>
          {mode === "create" ? (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => onChange({ password: generateTemporaryPassword() })}
              disabled={disabled}
            >
              Generate password
            </button>
          ) : null}
        </div>
        <Input
          type="text"
          value={values.password}
          onChange={(e) => onChange({ password: e.target.value })}
          disabled={disabled}
          placeholder={mode === "edit" ? "Leave blank to keep current password" : undefined}
          className="h-11 rounded-2xl border-border/70 font-mono text-sm"
          autoComplete="new-password"
        />
        {mode === "edit" ? (
          <p className="text-xs text-muted-foreground">
            Only enter a new password if you want to replace the current one.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function AppUserWorkspaceDetailsStep({
  values,
  onChange,
  mode,
  employees,
  editingEmployeeId,
  disabled,
}: StepProps) {
  const showEmployeeIdentityFields = roleNeedsEmployeeIdentity(values.appRole);
  const occupancy = React.useMemo(() => seatOccupancyMap(employees), [employees]);
  const vacantSeats = React.useMemo(() => {
    const currentSeat = values.bayNumber;
    return ALL_SEAT_IDS.filter(
      (id) =>
        !occupancy.has(id) ||
        (editingEmployeeId && occupancy.get(id)?.id === editingEmployeeId),
    ).filter((id) => id !== currentSeat || !occupancy.has(id));
  }, [employees, occupancy, editingEmployeeId, values.bayNumber]);

  const seatOptions = React.useMemo(() => {
    const options = [...vacantSeats];
    if (
      values.bayNumber &&
      values.bayNumber !== UNASSIGNED_SEAT &&
      !options.includes(values.bayNumber)
    ) {
      options.unshift(values.bayNumber);
    }
    return options;
  }, [vacantSeats, values.bayNumber]);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Contact info, addresses, seat, and profile photo.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="account-work-email">Work email</Label>
            <Input
              id="account-work-email"
              type="email"
              value={values.workEmail}
              onChange={(e) => onChange({ workEmail: e.target.value })}
              disabled={disabled}
              placeholder="work@colan.io"
              className="h-11 rounded-2xl border-border/70"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="account-phone">Phone</Label>
            <Input
              id="account-phone"
              value={values.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              disabled={disabled}
              placeholder="+1-555-0100"
              className="h-11 rounded-2xl border-border/70"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="account-current-address">Current address</Label>
            <Textarea
              id="account-current-address"
              value={values.currentAddress}
              onChange={(e) => onChange({ currentAddress: e.target.value })}
              disabled={disabled}
              placeholder="Where the employee is currently staying"
              rows={3}
              className="min-h-[88px] resize-y rounded-2xl border-border/70 bg-background"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="account-permanent-address">Permanent address</Label>
            <Textarea
              id="account-permanent-address"
              value={values.permanentAddress}
              onChange={(e) => onChange({ permanentAddress: e.target.value })}
              disabled={disabled}
              placeholder="Permanent / home address"
              rows={3}
              className="min-h-[88px] resize-y rounded-2xl border-border/70 bg-background"
            />
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              Saved to the employee profile and team member directory.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="account-joined-date">Joined date</Label>
            <Input
              id="account-joined-date"
              type="date"
              value={values.joinedDate}
              onChange={(e) => onChange({ joinedDate: e.target.value })}
              disabled={disabled}
              className="h-11 rounded-2xl border-border/70"
            />
          </div>

          {showEmployeeIdentityFields ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Office seat</Label>
              <Select
                value={values.bayNumber}
                onValueChange={(value) => onChange({ bayNumber: value })}
                disabled={disabled}
              >
                <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85">
                  <SelectValue placeholder="Select a seat" />
                </SelectTrigger>
                <SelectContent className="max-h-72 rounded-2xl border-border/60">
                  <SelectItem value={UNASSIGNED_SEAT}>No seat assigned</SelectItem>
                  {seatOptions.map((seatId) => (
                    <SelectItem key={seatId} value={seatId}>
                      Seat {seatId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {seatOptions.length} seats available on the floor plan
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Profile image
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight">Upload and preview</h3>
        </div>
        <AvatarUploadField
          value={values.imageUrl}
          previewName={values.name || values.email || "Account"}
          onChange={(value) => onChange({ imageUrl: value })}
          disabled={disabled}
        />
      </section>
    </div>
  );
}

/** @deprecated Use step components for create/edit flows. */
export function AppUserAccountFormFields(props: StepProps) {
  return (
    <div className="space-y-6">
      <AppUserAccountDetailsStep {...props} />
      <AppUserWorkspaceDetailsStep {...props} />
    </div>
  );
}
