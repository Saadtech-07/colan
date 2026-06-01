"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  Plus,
} from "lucide-react";
import { AvatarUploadField } from "@/components/features/avatar-upload-field";
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
import { seatOccupancyMap } from "@/lib/seating-utils";
import { generateTemporaryPassword } from "@/lib/password-utils";
import { cn } from "@/lib/utils";
import type { AppRole, Employee, TeamName } from "@/types";
import type { AppUserPublicDTO } from "@/models/app-user.model";
import type { WorkspaceRole } from "@/models";

const UNASSIGNED_SEAT = "__unassigned__";

export type AccountSetupForm = {
  email: string;
  name: string;
  employeeId: string;
  appRole: AppRole;
  team: TeamName;
  password: string;
  imageUrl: string;
};

export type EmployeeProfileForm = {
  workEmail: string;
  phone: string;
  location: string;
  joinedDate: string;
  notes: string;
  bayNumber: string;
};

export type CreateAppUserWizardResult = AppUserPublicDTO & {
  emailDelivery?: {
    attempted: boolean;
    sent: boolean;
    provider: "nodemailer";
    message?: string;
    id?: string;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTeam: TeamName;
  teamNames: string[];
  workspaceRoles: WorkspaceRole[];
  users: AppUserPublicDTO[];
  employees: Employee[];
  submitting: boolean;
  onSubmit: (
    account: AccountSetupForm,
    profile: EmployeeProfileForm,
  ) => Promise<void>;
};

function buildAccountForm(defaultTeam: TeamName): AccountSetupForm {
  return {
    email: "",
    name: "",
    employeeId: "",
    appRole: "employee",
    team: defaultTeam,
    password: generateTemporaryPassword(),
    imageUrl: "",
  };
}

function buildProfileForm(accountEmail: string): EmployeeProfileForm {
  return {
    workEmail: accountEmail,
    phone: "",
    location: "",
    joinedDate: new Date().toISOString().split("T")[0],
    notes: "",
    bayNumber: UNASSIGNED_SEAT,
  };
}

function WizardSteps({ step }: { step: 1 | 2 }) {
  const steps = [
    { number: 1, label: "Account Setup" },
    { number: 2, label: "Employee Details" },
  ] as const;

  return (
    <div className="flex items-center gap-2">
      {steps.map((item, index) => {
        const isActive = step === item.number;
        const isComplete = step > item.number;

        return (
          <React.Fragment key={item.number}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  isComplete && "border-primary bg-primary text-primary-foreground",
                  isActive && "border-primary bg-primary/10 text-primary",
                  !isActive && !isComplete && "border-border/70 bg-muted/30 text-muted-foreground",
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : item.number}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-xs font-semibold",
                    isActive || isComplete ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  Step {item.number}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{item.label}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "hidden h-px w-8 shrink-0 sm:block",
                  step > item.number ? "bg-primary" : "bg-border/70",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function validateAccountStep(
  account: AccountSetupForm,
  users: AppUserPublicDTO[],
  employees: Employee[],
): string | null {
  const email = account.email.trim().toLowerCase();
  const employeeId = account.employeeId.trim();

  if (!email) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  if (users.some((user) => user.email.toLowerCase() === email)) {
    return "An account with this email already exists.";
  }

  if (!account.name.trim()) return "Full name is required.";

  if (!employeeId) return "Employee ID is required.";
  const employeeIdLower = employeeId.toLowerCase();
  if (
    users.some((user) => user.employeeId?.trim().toLowerCase() === employeeIdLower) ||
    employees.some((employee) => employee.employeeId.trim().toLowerCase() === employeeIdLower)
  ) {
    return "This employee ID is already in use.";
  }

  if (!account.appRole.trim()) return "Role is required.";
  if (!account.team.trim()) return "Team is required.";

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
  const [step, setStep] = React.useState<1 | 2>(1);
  const [error, setError] = React.useState<string | null>(null);
  const [account, setAccount] = React.useState<AccountSetupForm>(() =>
    buildAccountForm(defaultTeam),
  );
  const [profile, setProfile] = React.useState<EmployeeProfileForm>(() => buildProfileForm(""));

  const occupancy = React.useMemo(() => seatOccupancyMap(employees), [employees]);
  const vacantSeats = React.useMemo(
    () => ALL_SEAT_IDS.filter((id) => !occupancy.has(id)),
    [occupancy],
  );

  const resetWizard = React.useCallback(() => {
    setStep(1);
    setError(null);
    setAccount(buildAccountForm(defaultTeam));
    setProfile(buildProfileForm(""));
  }, [defaultTeam]);

  React.useEffect(() => {
    if (!open) return;
    resetWizard();
  }, [open, resetWizard]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !submitting) {
      resetWizard();
    }
    onOpenChange(nextOpen);
  };

  const handleContinue = () => {
    setError(null);
    const validationError = validateAccountStep(account, users, employees);
    if (validationError) {
      setError(validationError);
      return;
    }

    setProfile((prev) => ({
      ...buildProfileForm(account.email.trim().toLowerCase()),
      phone: prev.phone,
      location: prev.location,
      joinedDate: prev.joinedDate || new Date().toISOString().split("T")[0],
      notes: prev.notes,
      bayNumber: prev.bayNumber,
    }));
    setStep(2);
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await onSubmit(account, profile);
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create account.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden border-border/70 bg-background/95 p-0 sm:max-w-3xl">
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="space-y-4 border-b border-border/60 px-6 py-5">
            <div className="space-y-3">
              <Badge
                variant="muted"
                className="w-fit rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
              >
                New workspace account
              </Badge>
              <div>
                <DialogTitle className="text-xl">Create account</DialogTitle>
                <DialogDescription className="mt-1">
                  {step === 1
                    ? "Set up login credentials and workspace access."
                    : "Complete employee profile and optional seat assignment."}
                </DialogDescription>
              </div>
            </div>
            <WizardSteps step={step} />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {step === 1 ? (
              <div className="space-y-6">
                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Step 1
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Account details
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wizard-email">Email *</Label>
                      <Input
                        id="wizard-email"
                        type="email"
                        value={account.email}
                        onChange={(event) =>
                          setAccount((prev) => ({ ...prev, email: event.target.value }))
                        }
                        className="h-11 rounded-2xl border-border/70"
                        placeholder="name@colan.io"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wizard-name">Full name *</Label>
                      <Input
                        id="wizard-name"
                        value={account.name}
                        onChange={(event) =>
                          setAccount((prev) => ({ ...prev, name: event.target.value }))
                        }
                        className="h-11 rounded-2xl border-border/70"
                        placeholder="Full name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wizard-employee-id">Employee ID *</Label>
                      <Input
                        id="wizard-employee-id"
                        value={account.employeeId}
                        onChange={(event) =>
                          setAccount((prev) => ({ ...prev, employeeId: event.target.value }))
                        }
                        className="h-11 rounded-2xl border-border/70"
                        placeholder="COL-1001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Role *</Label>
                      <Select
                        value={account.appRole}
                        onValueChange={(value) =>
                          setAccount((prev) => ({ ...prev, appRole: value as AppRole }))
                        }
                      >
                        <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85">
                          <SelectValue>
                            {workspaceRoles.find((role) => role.key === account.appRole)?.name ??
                              account.appRole}
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
                      <Label>Team *</Label>
                      <Select
                        value={account.team}
                        onValueChange={(value) =>
                          setAccount((prev) => ({ ...prev, team: value as TeamName }))
                        }
                      >
                        <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85">
                          <SelectValue>{account.team}</SelectValue>
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
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Security
                      </p>
                      <h3 className="mt-1 text-base font-semibold tracking-tight">Password *</h3>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl text-xs"
                      onClick={() =>
                        setAccount((prev) => ({
                          ...prev,
                          password: generateTemporaryPassword(),
                        }))
                      }
                    >
                      Generate password
                    </Button>
                  </div>
                  <Input
                    type="text"
                    value={account.password}
                    onChange={(event) =>
                      setAccount((prev) => ({ ...prev, password: event.target.value }))
                    }
                    className="h-11 rounded-2xl border-border/70 font-mono text-sm"
                    autoComplete="new-password"
                  />
                </section>

                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Profile image
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Upload profile image
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">Optional</p>
                  </div>
                  <AvatarUploadField
                    value={account.imageUrl}
                    previewName={account.name || account.email || "New account"}
                    onChange={(value) =>
                      setAccount((prev) => ({
                        ...prev,
                        imageUrl: value,
                      }))
                    }
                    disabled={submitting}
                  />
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Step 2
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Personal & workspace details
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wizard-work-email">Work email</Label>
                      <Input
                        id="wizard-work-email"
                        type="email"
                        value={profile.workEmail}
                        onChange={(event) =>
                          setProfile((prev) => ({ ...prev, workEmail: event.target.value }))
                        }
                        className="h-11 rounded-2xl border-border/70"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wizard-phone">Phone number</Label>
                      <Input
                        id="wizard-phone"
                        value={profile.phone}
                        onChange={(event) =>
                          setProfile((prev) => ({ ...prev, phone: event.target.value }))
                        }
                        className="h-11 rounded-2xl border-border/70"
                        placeholder="+1-555-0100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wizard-location">Location</Label>
                      <Input
                        id="wizard-location"
                        value={profile.location}
                        onChange={(event) =>
                          setProfile((prev) => ({ ...prev, location: event.target.value }))
                        }
                        className="h-11 rounded-2xl border-border/70"
                        placeholder="Chennai HQ"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wizard-joined-date">Joined date</Label>
                      <Input
                        id="wizard-joined-date"
                        type="date"
                        value={profile.joinedDate}
                        onChange={(event) =>
                          setProfile((prev) => ({ ...prev, joinedDate: event.target.value }))
                        }
                        className="h-11 rounded-2xl border-border/70"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wizard-notes">Notes</Label>
                      <Textarea
                        id="wizard-notes"
                        value={profile.notes}
                        onChange={(event) =>
                          setProfile((prev) => ({ ...prev, notes: event.target.value }))
                        }
                        className="min-h-[100px] rounded-2xl border-border/70"
                        placeholder="Onboarding notes, access context, or workspace remarks."
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Seating
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Office seat assignment
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Only available seats from the current floor plan are shown.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Office seat</Label>
                    <Select
                      value={profile.bayNumber}
                      onValueChange={(value) =>
                        setProfile((prev) => ({ ...prev, bayNumber: value }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85">
                        <SelectValue placeholder="Select a seat" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72 rounded-2xl border-border/60">
                        <SelectItem value={UNASSIGNED_SEAT}>No seat assigned</SelectItem>
                        {vacantSeats.map((seatId) => (
                          <SelectItem key={seatId} value={seatId}>
                            Seat {seatId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {vacantSeats.length} seats available · {occupancy.size} occupied
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur sm:justify-between">
            <div className="text-xs leading-5 text-muted-foreground">
              {step === 1
                ? "Account credentials are saved locally until you finish step 2."
                : "Creating the account will provision the linked employee workspace record."}
            </div>

            <div className="flex items-center gap-2">
              {step === 1 ? (
                <>
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
                    onClick={handleContinue}
                    disabled={submitting}
                  >
                    Save & Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl border-border/70 bg-background/80"
                    onClick={handleBack}
                    disabled={submitting}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
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
                </>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
