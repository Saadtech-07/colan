"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheckBig,
  Loader2,
  Pencil,
  Plus,
  Save,
  TriangleAlert,
  Trash2,
  UserCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { roleNeedsTeam } from "@/lib/permissions";
import type { AppRole, TeamName } from "@/types";
import type { AppUserPublicDTO } from "@/models/app-user.model";

const initialFormState = {
  email: "",
  name: "",
  password: "",
  employeeId: "",
  appRole: "employee" as AppRole,
  team: "React Team" as TeamName,
  imageUrl: "",
};

type CreateAccountToast = {
  variant: "success" | "warning";
  title: string;
  description: string;
};

type AppUserMutationResponse = AppUserPublicDTO & {
  emailDelivery?: {
    attempted: boolean;
    sent: boolean;
    provider: "nodemailer";
    message?: string;
    id?: string;
  };
};

export default function AppUsersPage() {
  const router = useRouter();
  const { isAdmin, user, refreshData, teamNames, workspaceRoles } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();
  const [users, setUsers] = React.useState<AppUserPublicDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<CreateAccountToast | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(initialFormState);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const formCardRef = React.useRef<HTMLDivElement | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  const submitting = isLoadingKey("app-users-submit");
  const showTeamField = roleNeedsTeam(form.appRole);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await withLoading("app-users-fetch", LOADING_PRESETS.loadingAccounts, async () => {
        const res = await fetch("/api/app-users", {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(await parseApiError(res));
        }
        setUsers((await res.json()) as AppUserPublicDTO[]);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load accounts.");
    } finally {
      setLoading(false);
    }
  }, [withLoading]);

  React.useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setTimeout(() => {
      void fetchUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchUsers, isAdmin]);

  const showToast = React.useCallback((next: CreateAccountToast) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(next);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  React.useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const resetForm = (opts?: { clearFeedback?: boolean }) => {
    setEditingId(null);
    setForm(initialFormState);
    if (opts?.clearFeedback !== false) {
      setSuccess(null);
      setError(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startCreate = () => {
    resetForm();
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.email || !form.name) {
      setError("Email and name are required.");
      return;
    }

    if (!editingId && form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (showTeamField && !form.team) {
      setError("Team is required for lead and employee roles.");
      return;
    }

    const preset = editingId
      ? LOADING_PRESETS.updatingAccount
      : LOADING_PRESETS.creatingAccount;
    const isEditing = !!editingId;

    try {
      await withLoading("app-users-submit", preset, async () => {
        const endpoint = editingId ? `/api/app-users/${editingId}` : "/api/app-users";
        const method = editingId ? "PATCH" : "POST";
        const body = {
          name: form.name,
          employeeId: form.employeeId,
          appRole: form.appRole,
          team: showTeamField ? form.team : undefined,
          imageUrl: form.imageUrl || undefined,
          ...(editingId
            ? {}
            : {
                email: form.email.toLowerCase(),
                password: form.password,
              }),
          ...(editingId && form.password ? { password: form.password } : {}),
        };
        const res = await fetch(endpoint, {
          method,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await parseApiError(res));
        }
        const result = (await res.json()) as AppUserMutationResponse;
        await fetchUsers();
        await refreshData();
        router.refresh();

        resetForm({ clearFeedback: false });

        if (isEditing) {
          setSuccess("Account updated successfully.");
          return;
        }

        setSuccess("Employee account created successfully.");

        if (result.emailDelivery?.sent) {
          showToast({
            variant: "success",
            title: "Employee account created successfully",
            description: "Login credentials email sent.",
          });
          return;
        }

        showToast({
          variant: "warning",
          title: "Employee created but email could not be sent",
          description:
            result.emailDelivery?.message ||
            "Check the email configuration and resend the credentials manually.",
        });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save account.");
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete account ${email}? This cannot be undone.`)) return;
    setError(null);
    setSuccess(null);
    try {
      await withLoading("app-users-delete", LOADING_PRESETS.removingAccount, async () => {
        const res = await fetch(`/api/app-users/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(await parseApiError(res));
        }
        await fetchUsers();
        await refreshData();
        router.refresh();
        setSuccess("Account removed.");
        if (editingId === id) resetForm({ clearFeedback: false });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete account.");
    }
  };

  const startEdit = (userRecord: AppUserPublicDTO) => {
    setEditingId(userRecord.id);
    setForm({
      email: userRecord.email,
      name: userRecord.name,
      password: "",
      employeeId: userRecord.employeeId ?? "",
      appRole: userRecord.appRole,
      team: userRecord.team ?? "React Team",
      imageUrl: userRecord.imageUrl ?? "",
    });
    setSuccess(null);
    setError(null);
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-3 text-muted-foreground">
          Only admin users can manage application accounts.
        </p>
      </div>
    );
  }

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
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <UserCheck className="h-4 w-4 text-primary" />
          {user?.email}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Accounts</CardTitle>
                <CardDescription>
                  {!loading && `${users.length} account(s) available.`}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={startCreate}
                aria-label="Create new account"
                title="Create new account"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            {error && !submitting && (
              <div className="mx-4 mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && !submitting && (
              <div className="mx-4 mb-4 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
                {success}
              </div>
            )}
            {!loading && (
              <div className="min-w-full overflow-hidden">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="bg-muted text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item.id} className="border-t border-border/70 hover:bg-muted/50">
                        <td className="px-4 py-4 align-top font-medium">{item.email}</td>
                        <td className="px-4 py-4 align-top">{item.name}</td>
                        <td className="px-4 py-4 align-top">
                          {workspaceRoles.find((r) => r.key === item.appRole)?.name ??
                            item.appRole}
                        </td>
                        <td className="px-4 py-4 align-top">{item.team ?? "—"}</td>
                        <td className="px-4 py-4 align-top text-right">
                          <div className="inline-flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEdit(item)}
                              aria-label={`Edit ${item.email}`}
                              title="Edit account"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(item.id, item.email)}
                              disabled={item.email === user?.email}
                              aria-label={`Delete ${item.email}`}
                              title="Delete account"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          No accounts found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card ref={formCardRef}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>{editingId ? "Edit account" : "Create account"}</CardTitle>
                <CardDescription>
                  {editingId
                    ? "Update login details and reset password."
                    : "Add a new user account for workspace access."}
                </CardDescription>
              </div>
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => resetForm()}
                  aria-label="Cancel edit"
                  title="Cancel edit"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  disabled={!!editingId}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder={editingId ? "Leave blank to keep current password" : "Set a password"}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <Label>Role</Label>
                  <Select
                    value={form.appRole}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        appRole: value as AppRole,
                        team: roleNeedsTeam(value as AppRole) ? prev.team : prev.team,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {workspaceRoles.find((r) => r.key === form.appRole)?.name ??
                          form.appRole}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {workspaceRoles.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showTeamField && (
                  <div className="space-y-3">
                    <Label>Team</Label>
                    <Select
                      value={form.team}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, team: value as TeamName }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{form.team}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {teamNames.map((team) => (
                          <SelectItem key={team} value={team}>
                            {team}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input
                  value={form.employeeId || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      employeeId: e.target.value,
                    }))
                  }
                  placeholder="COL-1001"
                />
              </div>
              <div className="space-y-3">
                <Label>Employee Image</Label>
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 transition hover:border-primary hover:bg-muted/50"
                  >
                    {form.imageUrl ? (
                      <>
                        <img
                          src={form.imageUrl}
                          alt="Employee"
                          className="h-14 w-14 rounded-full border object-cover"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Image Selected</span>
                          <span className="text-xs text-muted-foreground">Click to change image</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Upload className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Upload Employee Image</span>
                          <span className="text-xs text-muted-foreground">PNG, JPG or JPEG</span>
                        </div>
                      </>
                    )}
                  </div>
                  {form.imageUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          imageUrl: "",
                        }));
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      aria-label="Remove image"
                      title="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const localImageUrl = URL.createObjectURL(file);
                      setForm((prev) => ({
                        ...prev,
                        imageUrl: localImageUrl,
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10"
                  disabled={submitting}
                  aria-label={editingId ? "Update account" : "Create account"}
                  title={editingId ? "Update account" : "Create account"}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : editingId ? (
                    <Save className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
