"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CircleCheckBig,
  ImagePlus,
  KeyRound,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Label } from "@/components/ui/label";
import { parseApiError, useAppState } from "@/providers/app-state";

type ProfileSettingsResponse = {
  email: string;
  name: string;
  appRole: string;
  team?: string;
  employeeId: string;
  imageUrl: string;
  isProfileCompleted: boolean;
  updatedProfileAt?: string;
  workspaceRole?: string;
  phone?: string;
  location?: string;
  bayNumber?: string;
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

const initialForm = {
  name: "",
  imageUrl: "",
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
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
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const { refreshProfileAvatar } = useAppState();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const loadedForEmailRef = React.useRef<string | null>(null);
  const loadInFlightRef = React.useRef(false);

  const [profile, setProfile] = React.useState<ProfileSettingsResponse | null>(null);
  const [form, setForm] = React.useState(initialForm);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const showToast = React.useCallback((next: ToastState) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(next);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  React.useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const loadProfile = React.useCallback(async (email: string) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile-settings", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const nextProfile = (await res.json()) as ProfileSettingsResponse;
      setProfile(nextProfile);
      setForm((prev) => ({
        name: prev.name === (profile?.name ?? "") ? nextProfile.name : prev.name,
        imageUrl:
          !prev.imageUrl || prev.imageUrl === profile?.imageUrl
            ? nextProfile.imageUrl
            : prev.imageUrl,
        currentPassword: prev.currentPassword,
        newPassword: prev.newPassword,
        confirmNewPassword: prev.confirmNewPassword,
      }));
      loadedForEmailRef.current = email;
    } catch (nextError) {
      loadedForEmailRef.current = null;
      setError(nextError instanceof Error ? nextError.message : "Unable to load profile settings.");
    } finally {
      setLoading(false);
      loadInFlightRef.current = false;
    }
  }, [profile?.imageUrl, profile?.name]);

  const refreshProfileFromServer = React.useCallback(async () => {
    const email = session?.user?.email?.trim().toLowerCase() ?? "";
    if (!email || saving) return;
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    try {
      const res = await fetch("/api/profile-settings", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const nextProfile = (await res.json()) as ProfileSettingsResponse;
      setProfile(nextProfile);
      setForm((prev) => ({
        name: prev.name === (profile?.name ?? "") ? nextProfile.name : prev.name,
        imageUrl:
          !prev.imageUrl || prev.imageUrl === profile?.imageUrl
            ? nextProfile.imageUrl
            : prev.imageUrl,
        currentPassword: prev.currentPassword,
        newPassword: prev.newPassword,
        confirmNewPassword: prev.confirmNewPassword,
      }));
    } catch {
      // Ignore background refresh errors.
    } finally {
      loadInFlightRef.current = false;
    }
  }, [profile?.imageUrl, profile?.name, saving, session?.user?.email]);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      loadedForEmailRef.current = null;
      setProfile(null);
      setForm(initialForm);
      setLoading(false);
      return;
    }
    if (status !== "authenticated") return;

    const email = session?.user?.email?.trim().toLowerCase() ?? "";
    if (!email) return;
    if (loadedForEmailRef.current === email) return;

    void loadProfile(email);
  }, [loadProfile, session?.user?.email, status]);

  React.useEffect(() => {
    if (status !== "authenticated") return;

    const refresh = () => {
      void refreshProfileFromServer();
    };
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 30_000);

    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [refreshProfileFromServer, status]);

  const handleReset = () => {
    if (!profile) return;
    setForm({
      name: profile.name,
      imageUrl: profile.imageUrl,
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, imageUrl: result }));
      setError(null);
    };
    reader.onerror = () => setError("Unable to read the selected image.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Full name is required.");
      return;
    }

    const isOnboarding = profile.isProfileCompleted === false;

    if (isOnboarding && !form.newPassword.trim()) {
      setError("Set a new password to complete your first login setup.");
      return;
    }

    if (form.newPassword.trim() && form.confirmNewPassword.trim() !== form.newPassword.trim()) {
      setError("Confirm password must match the new password.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/profile-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          imageUrl: form.imageUrl,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
          confirmNewPassword: form.confirmNewPassword,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));

      const updated = (await res.json()) as ProfileSettingsResponse;
      const wasOnboarding = profile.isProfileCompleted === false;
      setProfile(updated);
      setForm({
        name: updated.name,
        imageUrl: updated.imageUrl,
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";

      await update({
        name: updated.name,
        appRole: updated.appRole,
        team: updated.team,
        isProfileCompleted: updated.isProfileCompleted,
      });
      await refreshProfileAvatar();

      if (wasOnboarding) {
        showToast({
          variant: "success",
          title: "Profile setup completed",
          description: "Your profile has been saved. Redirecting to dashboard...",
        });
        router.refresh();
        window.setTimeout(() => {
          window.location.assign("/dashboard");
        }, 400);
        return;
      }

      showToast({
        variant: "success",
        title: "Profile updated",
        description: "Your profile settings have been saved.",
      });
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "Unable to save your profile settings.";
      setError(message);
      showToast({
        variant: "warning",
        title: "Profile update failed",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const strength = passwordStrength(form.newPassword);
  const previewName =
    form.name.trim() || profile?.name || session?.user?.name || session?.user?.email || "User";
  const isOnboarding = profile?.isProfileCompleted === false;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-4 top-20 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6">
          <div
            className={
              toast.variant === "success"
                ? "rounded-2xl border border-emerald-500/30 bg-card p-4 shadow-xl"
                : "rounded-2xl border border-amber-500/30 bg-card p-4 shadow-xl"
            }
          >
            <div className="flex items-start gap-3">
              <div
                className={
                  toast.variant === "success"
                    ? "mt-0.5 rounded-full bg-emerald-500/10 p-2 text-emerald-600"
                    : "mt-0.5 rounded-full bg-amber-500/10 p-2 text-amber-600"
                }
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
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isOnboarding ? "First login setup" : "Account settings"}
            </div>
            <CardTitle className="text-xl">
              {isOnboarding ? "Complete your profile" : "Profile settings"}
            </CardTitle>
            <CardDescription>
              {isOnboarding
                ? "Update your personal details and password before entering the dashboard."
                : "Update your profile photo and password whenever you need to."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingIndicator title="Loading Profile Settings" className="min-h-[320px]" />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Avatar className="h-20 w-20 ring-4 ring-muted">
                      <AvatarImage src={form.imageUrl || profile?.imageUrl} alt={previewName} />
                      <AvatarFallback className="text-lg font-semibold">
                        {previewName
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="h-4 w-4" />
                        Upload photo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, imageUrl: "" }));
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        Remove
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="profile-name">Full name</Label>
                      <Input
                        id="profile-name"
                        value={form.name}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-email">Email</Label>
                      <Input
                        id="profile-email"
                        value={profile?.email ?? session?.user?.email ?? ""}
                        readOnly
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-employee-id">Employee ID</Label>
                      <Input id="profile-employee-id" value={profile?.employeeId ?? ""} readOnly disabled />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-app-role">Access role</Label>
                      <Input
                        id="profile-app-role"
                        value={
                          APP_ROLE_LABELS[profile?.appRole ?? ""] ??
                          profile?.appRole ??
                          ""
                        }
                        readOnly
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-team">Team</Label>
                      <Input
                        id="profile-team"
                        value={profile?.team?.trim() || "—"}
                        readOnly
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-workspace-role">Workspace role</Label>
                      <Input
                        id="profile-workspace-role"
                        value={profile?.workspaceRole?.trim() || "—"}
                        readOnly
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-phone">Phone</Label>
                      <Input
                        id="profile-phone"
                        value={profile?.phone?.trim() || "—"}
                        readOnly
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-location">Location</Label>
                      <Input
                        id="profile-location"
                        value={profile?.location?.trim() || "—"}
                        readOnly
                        disabled
                      />
                    </div>

                    {profile?.bayNumber ? (
                      <div className="space-y-2">
                        <Label htmlFor="profile-seat">Assigned seat</Label>
                        <Input id="profile-seat" value={profile.bayNumber} readOnly disabled />
                      </div>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Team, access role, and directory details are managed by administrators. Contact
                    your admin if anything needs to change.
                  </p>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Security
                    </h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="current-password">
                        {isOnboarding ? "Temporary password" : "Current password"}
                      </Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={form.currentPassword}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                        }
                        placeholder={
                          isOnboarding
                            ? "Enter the password from your welcome email"
                            : "Required only if changing password"
                        }
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
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, newPassword: event.target.value }))
                        }
                        placeholder={
                          isOnboarding
                            ? "Create your new password"
                            : "Leave blank to keep current password"
                        }
                      />
                      {strength && <p className={`text-xs font-medium ${strength.tone}`}>{strength.label}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm new password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={form.confirmNewPassword}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, confirmNewPassword: event.target.value }))
                        }
                        placeholder="Re-enter the new password"
                      />
                    </div>
                  </div>
                </section>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button type="button" variant="outline" onClick={handleReset} disabled={saving}>
                    Reset
                  </Button>
                  <Button type="submit" disabled={saving} className="min-w-[180px]">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving profile...
                      </>
                    ) : isOnboarding ? (
                      "Save and continue"
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-gradient-to-br from-slate-50 to-white shadow-sm dark:from-slate-950 dark:to-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="h-5 w-5 text-primary" />
              Setup checklist
            </CardTitle>
            <CardDescription>
              {isOnboarding
                ? "Finish these items once to unlock the normal dashboard experience."
                : "You can return here anytime from the header menu to update your profile."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
              <p className="font-medium text-foreground">What happens after save?</p>
              <p className="mt-2">
                Your account will be marked as completed and all future logins will open the
                dashboard directly.
              </p>
            </div>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <CircleCheckBig className="mt-0.5 h-4 w-4 text-emerald-600" />
                Review your name and profile photo.
              </li>
              <li className="flex gap-3">
                <CircleCheckBig className="mt-0.5 h-4 w-4 text-emerald-600" />
                Keep your work email unchanged for admin-managed access.
              </li>
              <li className="flex gap-3">
                <CircleCheckBig className="mt-0.5 h-4 w-4 text-emerald-600" />
                Change the temporary password before continuing.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
