"use client";

import * as React from "react";
import { useSession } from "@/components/providers/auth-session-provider";
import {
  ProfileSettingsContent,
  initialProfileSettingsForm,
  type ProfileSettingsFormState,
} from "@/components/features/profile-settings-content";
import type { AppUserProfileDTO } from "@/lib/app-users";
import { parseApiError, useAppState } from "@/providers/app-state";
import { loggedFetch } from "@/lib/logged-fetch";
import {
  fetchProfileSettings,
  invalidateProfileSettingsCache,
} from "@/lib/profile-settings-client";
import {
  readResumeAsDataUrl,
  sanitizeResumeFileName,
  validateResumeUpload,
} from "@/lib/resume-upload";

type ToastState = {
  variant: "success" | "warning";
  title: string;
  description: string;
};

export default function ProfileSettingsPage() {
  const { data: session, status, update } = useSession();
  const { applyProfileSnapshot } = useAppState();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const resumeInputRef = React.useRef<HTMLInputElement | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const loadedForEmailRef = React.useRef<string | null>(null);
  const loadInFlightRef = React.useRef(false);

  const [profile, setProfile] = React.useState<AppUserProfileDTO | null>(null);
  const [form, setForm] = React.useState<ProfileSettingsFormState>(initialProfileSettingsForm);
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

  const syncFormFromProfile = React.useCallback(
    (nextProfile: AppUserProfileDTO, preservePasswordFields: boolean) => {
      setForm((prev) => ({
        imageUrl:
          !prev.imageUrl || prev.imageUrl === profile?.imageUrl
            ? nextProfile.imageUrl
            : prev.imageUrl,
        resumeUrl:
          !prev.resumeUrl || prev.resumeUrl === profile?.resumeUrl
            ? nextProfile.resumeUrl ?? ""
            : prev.resumeUrl,
        resumeFileName:
          !prev.resumeFileName || prev.resumeFileName === profile?.resumeFileName
            ? nextProfile.resumeFileName ?? ""
            : prev.resumeFileName,
        resumeMimeType:
          !prev.resumeMimeType || prev.resumeMimeType === profile?.resumeMimeType
            ? nextProfile.resumeMimeType ?? ""
            : prev.resumeMimeType,
        currentPassword: preservePasswordFields ? prev.currentPassword : "",
        newPassword: preservePasswordFields ? prev.newPassword : "",
        confirmNewPassword: preservePasswordFields ? prev.confirmNewPassword : "",
      }));
    },
    [profile?.imageUrl, profile?.resumeFileName, profile?.resumeMimeType, profile?.resumeUrl],
  );

  const loadProfile = React.useCallback(async (email: string) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const nextProfile = (await fetchProfileSettings(email)) as AppUserProfileDTO;
      setProfile(nextProfile);
      syncFormFromProfile(nextProfile, true);
      loadedForEmailRef.current = email;
    } catch (nextError) {
      loadedForEmailRef.current = null;
      setError(nextError instanceof Error ? nextError.message : "Unable to load profile settings.");
    } finally {
      setLoading(false);
      loadInFlightRef.current = false;
    }
  }, [syncFormFromProfile]);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      loadedForEmailRef.current = null;
      setProfile(null);
      setForm(initialProfileSettingsForm);
      setLoading(false);
      return;
    }
    if (status !== "authenticated") return;

    const email = session?.user?.email?.trim().toLowerCase() ?? "";
    if (!email) return;
    if (loadedForEmailRef.current === email) return;

    void loadProfile(email);
  }, [loadProfile, session?.user?.email, status]);

  const handleReset = () => {
    if (!profile) return;
    setForm({
      imageUrl: profile.imageUrl,
      resumeUrl: profile.resumeUrl ?? "",
      resumeFileName: profile.resumeFileName ?? "",
      resumeMimeType: profile.resumeMimeType ?? "",
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (resumeInputRef.current) resumeInputRef.current.value = "";
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

  const handleResumeFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateResumeUpload(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const dataUrl = await readResumeAsDataUrl(file);
      setForm((prev) => ({
        ...prev,
        resumeUrl: dataUrl,
        resumeFileName: sanitizeResumeFileName(file.name),
        resumeMimeType: file.type || "application/pdf",
      }));
      setError(null);
    } catch {
      setError("Unable to read the selected resume.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    if (form.newPassword.trim() && form.confirmNewPassword.trim() !== form.newPassword.trim()) {
      setError("Confirm password must match the new password.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await loggedFetch("/api/profile-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: form.imageUrl,
          resumeUrl: form.resumeUrl,
          resumeFileName: form.resumeFileName,
          resumeMimeType: form.resumeMimeType,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
          confirmNewPassword: form.confirmNewPassword,
        }),
        source: "ProfileSettingsPage.handleSubmit",
      });
      if (!res.ok) throw new Error(await parseApiError(res));

      const updated = (await res.json()) as AppUserProfileDTO;
      invalidateProfileSettingsCache();
      const wasOnboarding = profile.isProfileCompleted === false;
      setProfile(updated);
      setForm({
        imageUrl: updated.imageUrl,
        resumeUrl: updated.resumeUrl ?? "",
        resumeFileName: updated.resumeFileName ?? "",
        resumeMimeType: updated.resumeMimeType ?? "",
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (resumeInputRef.current) resumeInputRef.current.value = "";

      await update({
        name: updated.name,
        appRole: updated.appRole,
        team: updated.team,
        isProfileCompleted: updated.isProfileCompleted,
      });
      await applyProfileSnapshot(updated);

      if (wasOnboarding) {
        showToast({
          variant: "success",
          title: "Profile setup completed",
          description: "Your profile has been saved. Redirecting to dashboard...",
        });
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

  return (
    <ProfileSettingsContent
      profile={profile}
      form={form}
      loading={loading}
      saving={saving}
      error={error}
      toast={toast}
      sessionEmail={session?.user?.email ?? undefined}
      onDismissToast={() => setToast(null)}
      onFormChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      onReset={handleReset}
      onSubmit={handleSubmit}
      onFileChange={handleFileChange}
      onRemovePhoto={() => {
        setForm((prev) => ({ ...prev, imageUrl: "" }));
        if (fileInputRef.current) fileInputRef.current.value = "";
      }}
      onResumeFileChange={handleResumeFileChange}
      onRemoveResume={() => {
        setForm((prev) => ({
          ...prev,
          resumeUrl: "",
          resumeFileName: "",
          resumeMimeType: "",
        }));
        if (resumeInputRef.current) resumeInputRef.current.value = "";
      }}
      fileInputRef={fileInputRef}
      resumeInputRef={resumeInputRef}
    />
  );
}
