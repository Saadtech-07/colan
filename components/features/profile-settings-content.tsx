"use client";

import * as React from "react";
import {
  CircleCheckBig,
  Download,
  Eye,
  FileText,
  ImagePlus,
  KeyRound,
  Loader2,
  MapPin,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { formatWorkspaceDate, parseSeatAllocation } from "@/lib/employee-workspace-ui";
import { profileNameInitial } from "@/lib/profile-image";
import {
  downloadResumeDocument,
  formatResumeUploadedAt,
  hasResumeDocument,
  resolveResumeFileName,
  viewResumeDocument,
} from "@/lib/resume-document";
import { RESUME_UPLOAD_ACCEPT } from "@/lib/resume-upload";
import { cn } from "@/lib/utils";
import type { AppUserProfileDTO } from "@/lib/app-users";

export type ProfileSettingsFormState = {
  imageUrl: string;
  resumeUrl: string;
  resumeFileName: string;
  resumeMimeType: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

export const initialProfileSettingsForm: ProfileSettingsFormState = {
  imageUrl: "",
  resumeUrl: "",
  resumeFileName: "",
  resumeMimeType: "",
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

const APP_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  lead: "Team Lead",
  employee: "Employee",
};

type ToastState = {
  variant: "success" | "warning";
  title: string;
  description: string;
};

function passwordStrength(password: string): { label: string; tone: string } | null {
  const value = password.trim();
  if (!value) return null;

  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) return { label: "Weak password", tone: "text-amber-600" };
  if (score <= 3) return { label: "Good password", tone: "text-sky-600" };
  return { label: "Strong password", tone: "text-emerald-600" };
};

function displayValue(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

type Props = {
  profile: AppUserProfileDTO | null;
  form: ProfileSettingsFormState;
  loading: boolean;
  saving: boolean;
  error: string | null;
  toast: ToastState | null;
  sessionEmail?: string;
  onDismissToast: () => void;
  onFormChange: (patch: Partial<ProfileSettingsFormState>) => void;
  onReset: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: () => void;
  onResumeFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveResume: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  resumeInputRef: React.RefObject<HTMLInputElement | null>;
};

export function ProfileSettingsContent({
  profile,
  form,
  loading,
  saving,
  error,
  toast,
  sessionEmail,
  onDismissToast,
  onFormChange,
  onReset,
  onSubmit,
  onFileChange,
  onRemovePhoto,
  onResumeFileChange,
  onRemoveResume,
  fileInputRef,
  resumeInputRef,
}: Props) {
  const strength = passwordStrength(form.newPassword);
  const isOnboarding = profile?.isProfileCompleted === false;
  const previewImage = form.imageUrl || profile?.imageUrl || "";
  const previewResumeUrl = form.resumeUrl || profile?.resumeUrl || "";
  const previewResumeFileName = resolveResumeFileName(
    {
      resumeUrl: previewResumeUrl,
      resumeFileName: form.resumeFileName || profile?.resumeFileName,
    },
    "resume.pdf",
  );
  const previewResumeUploadedAt =
    profile?.resumeUploadedAt && !form.resumeUrl
      ? profile.resumeUploadedAt
      : form.resumeUrl
        ? new Date().toISOString()
        : profile?.resumeUploadedAt;
  const hasResume = hasResumeDocument({ resumeUrl: previewResumeUrl });
  const previewName = profile?.name || sessionEmail || "User";
  const seat = parseSeatAllocation(profile?.bayNumber);
  const accessRole =
    APP_ROLE_LABELS[profile?.appRole ?? ""] ?? profile?.appRole ?? "—";

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed right-4 top-20 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6">
          <div
            className={cn(
              "rounded-2xl border bg-card p-4 shadow-xl",
              toast.variant === "success"
                ? "border-emerald-500/30"
                : "border-amber-500/30",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 rounded-full p-2",
                  toast.variant === "success"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-amber-500/10 text-amber-600",
                )}
              >
                {toast.variant === "success" ? (
                  <CircleCheckBig className="h-4 w-4" />
                ) : (
                  <TriangleAlert className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{toast.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={onDismissToast}
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(99,102,241,0.07)_0%,rgba(14,165,233,0.05)_50%,transparent_75%)]" />
            <div className="relative flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar className="h-[88px] w-[88px] shrink-0 border-[3px] border-background shadow-md ring-2 ring-primary/15">
                  <AvatarImage src={previewImage} alt={previewName} className="object-cover" />
                  <AvatarFallback className="bg-muted text-2xl font-semibold text-primary">
                    {profileNameInitial(previewName, profile?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-3">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {isOnboarding ? "First login setup" : "Your profile"}
                    </p>
                    <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
                      {previewName}
                    </h1>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs">
                        {accessRole}
                      </Badge>
                      {profile?.workspaceRole ? (
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs">
                          {profile.workspaceRole}
                        </Badge>
                      ) : null}
                      {profile?.team ? (
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs">
                          {profile.team}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {!loading ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-xl"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                      >
                        <ImagePlus className="h-4 w-4" />
                        Upload photo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        onClick={onRemovePhoto}
                        disabled={saving}
                      >
                        Remove
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onFileChange}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
                Workspace details are set by your administrator. Update your photo here or change
                your password below.
              </p>
            </div>
          </section>

          {loading ? (
            <Card className="border-border/70 shadow-sm">
              <CardContent className="py-10">
                <LoadingIndicator title="Loading profile settings" className="min-h-[280px]" />
              </CardContent>
            </Card>
          ) : (
            <>
              <RecordPanel
                title="Workspace details"
                description="Information from your account setup — read only"
                icon={Users}
              >
                <InfoGrid columns={2}>
                  <InfoRow label="Full name" value={displayValue(profile?.name)} />
                  <InfoRow
                    label="Login email"
                    value={displayValue(profile?.email ?? sessionEmail)}
                    href={
                      profile?.email || sessionEmail
                        ? `mailto:${profile?.email ?? sessionEmail}`
                        : undefined
                    }
                  />
                  <InfoRow
                    label="Work email"
                    value={displayValue(profile?.workEmail)}
                    href={
                      profile?.workEmail ? `mailto:${profile.workEmail}` : undefined
                    }
                  />
                  <InfoRow label="Employee ID" value={displayValue(profile?.employeeId)} mono />
                  <InfoRow label="Access role" value={accessRole} />
                  <InfoRow
                    label="Workspace role"
                    value={displayValue(profile?.workspaceRole)}
                  />
                  <InfoRow label="Team" value={displayValue(profile?.team)} />
                  <InfoRow label="Phone" value={displayValue(profile?.phone)} />
                  <InfoRow label="Joined date" value={formatWorkspaceDate(profile?.joinedDate)} />
                  <InfoRow
                    label="Office seat"
                    value={seat.isAssigned ? seat.seatNumber : "Unassigned"}
                  />
                  <InfoRow
                    label="Current address"
                    value={displayValue(profile?.currentAddress)}
                    icon={MapPin}
                    multiline
                  />
                  <InfoRow
                    label="Permanent address"
                    value={displayValue(profile?.permanentAddress)}
                    multiline
                    last
                  />
                </InfoGrid>
              </RecordPanel>

              <form onSubmit={onSubmit} className="space-y-5">
                {error ? (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                <RecordPanel
                  title="Resume"
                  description="Upload a PDF resume for your employee profile"
                  icon={FileText}
                >
                  <div className="space-y-4 px-5 py-5">
                    {hasResume ? (
                      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {previewResumeFileName}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Uploaded {formatResumeUploadedAt(previewResumeUploadedAt)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2 rounded-xl"
                              onClick={() => viewResumeDocument(previewResumeUrl)}
                              disabled={saving}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2 rounded-xl"
                              onClick={() =>
                                downloadResumeDocument(
                                  previewResumeUrl,
                                  previewResumeFileName,
                                )
                              }
                              disabled={saving}
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center">
                        <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-3 text-sm font-medium text-foreground">
                          No resume uploaded yet
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          PDF only, up to 8 MB.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-xl"
                        onClick={() => resumeInputRef.current?.click()}
                        disabled={saving}
                      >
                        <UploadCloud className="h-4 w-4" />
                        {hasResume ? "Replace resume" : "Upload resume"}
                      </Button>
                      {hasResume ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-xl"
                          onClick={onRemoveResume}
                          disabled={saving}
                        >
                          Remove
                        </Button>
                      ) : null}
                      <input
                        ref={resumeInputRef}
                        type="file"
                        accept={RESUME_UPLOAD_ACCEPT}
                        className="hidden"
                        onChange={onResumeFileChange}
                      />
                    </div>
                  </div>
                </RecordPanel>

                <RecordPanel
                  title="Security"
                  description={
                    isOnboarding
                      ? "Replace your temporary password to finish setup"
                      : "Change your login password"
                  }
                  icon={KeyRound}
                >
                  <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="current-password">
                        {isOnboarding ? "Temporary password" : "Current password"}
                      </Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={form.currentPassword}
                        onChange={(event) =>
                          onFormChange({ currentPassword: event.target.value })
                        }
                        disabled={saving}
                        placeholder={
                          isOnboarding
                            ? "Password from your welcome email"
                            : "Required when changing password"
                        }
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">
                        {isOnboarding ? "New password" : "New password (optional)"}
                      </Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={form.newPassword}
                        onChange={(event) => onFormChange({ newPassword: event.target.value })}
                        disabled={saving}
                        placeholder={
                          isOnboarding ? "Create your new password" : "Leave blank to keep current"
                        }
                        className="h-11 rounded-xl"
                      />
                      {strength ? (
                        <p className={`text-xs font-medium ${strength.tone}`}>{strength.label}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm new password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={form.confirmNewPassword}
                        onChange={(event) =>
                          onFormChange({ confirmNewPassword: event.target.value })
                        }
                        disabled={saving}
                        placeholder="Re-enter new password"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </RecordPanel>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={onReset}
                    disabled={saving}
                  >
                    Reset
                  </Button>
                  <Button type="submit" disabled={saving} className="min-w-[180px] rounded-xl">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : isOnboarding ? (
                      "Save and continue"
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>

        <Card className="h-fit border-border/70 bg-gradient-to-br from-slate-50/90 to-white shadow-sm dark:from-slate-950 dark:to-slate-900">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-primary" />
              {isOnboarding ? "Setup checklist" : "Need a change?"}
            </CardTitle>
            <CardDescription className="text-xs">
              {isOnboarding
                ? "Complete these steps once to unlock the dashboard."
                : "Contact your administrator to update role, team, or address details."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {isOnboarding ? (
              <div className="rounded-xl border border-border/60 bg-background/80 p-3.5 text-xs leading-relaxed">
                <p className="font-medium text-foreground">After you save</p>
                <p className="mt-1.5">
                  Your account is marked complete and future logins go straight to the dashboard.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-background/80 p-3.5 text-xs leading-relaxed">
                <p className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Admin-managed fields
                </p>
                <p className="mt-1.5">
                  Work email, employee ID, team, role, addresses, and seat assignment are updated
                  in App Users by an administrator.
                </p>
              </div>
            )}
            <ul className="space-y-2.5 text-xs">
              <ChecklistItem done label="Review your workspace details above." />
              <ChecklistItem
                done={Boolean(previewImage)}
                label="Upload a profile photo (optional)."
              />
              <ChecklistItem done={hasResume} label="Upload a resume (optional)." />
              <ChecklistItem
                done={!isOnboarding}
                label={
                  isOnboarding
                    ? "Set a new password before continuing."
                    : "Password is up to date."
                }
              />
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex gap-2.5">
      <CircleCheckBig
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          done ? "text-emerald-600" : "text-muted-foreground/35",
        )}
      />
      <span className={done ? "text-foreground" : undefined}>{label}</span>
    </li>
  );
}

function RecordPanel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function InfoGrid({
  children,
  columns = 1,
}: {
  children: React.ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <dl className={cn("divide-y divide-border/50", columns === 2 && "sm:grid sm:grid-cols-2 sm:divide-y-0")}>
      {children}
    </dl>
  );
}

function InfoRow({
  label,
  value,
  href,
  mono,
  multiline,
  icon: Icon,
  last,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
  multiline?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  last?: boolean;
}) {
  const content =
    href && value !== "—" ? (
      <a href={href} className="text-primary hover:underline">
        {value}
      </a>
    ) : (
      <span className={cn(mono && "font-mono text-[13px]", multiline && "whitespace-pre-wrap")}>
        {value}
      </span>
    );

  return (
    <div
      className={cn(
        "px-5 py-3.5 sm:border-border/50",
        !last && "border-b border-border/50 sm:border-b",
        last && columnsBorderLast(),
      )}
    >
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{content}</dd>
    </div>
  );
}

function columnsBorderLast(): string {
  return "sm:border-b-0";
}
