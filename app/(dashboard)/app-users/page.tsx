"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
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
import { ROLE_DEFINITIONS, APP_ROLES, roleNeedsTeam } from "@/lib/permissions";
import { TEAMS } from "@/lib/constants";
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

export default function AppUsersPage() {
  const router = useRouter();
  const { isAdmin, user, refreshData } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();
  const [users, setUsers] = React.useState<AppUserPublicDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(initialFormState);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
    void fetchUsers();
  }, [fetchUsers, isAdmin]);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialFormState);
    setSuccess(null);
    setError(null);
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
        await fetchUsers();
        await refreshData();
        router.refresh();
        setSuccess(
          editingId ? "Account updated successfully." : "Account created successfully.",
        );
        resetForm();
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
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">App account management</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Create, update, and delete login accounts for the Colan workspace.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <UserCheck className="h-4 w-4 text-primary" />
            {user?.email}
          </div>
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
                          {ROLE_DEFINITIONS[item.appRole]?.label ?? item.appRole}
                        </td>
                        <td className="px-4 py-4 align-top">{item.team ?? "—"}</td>
                        <td className="px-4 py-4 align-top text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mr-2"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(item.id, item.email)}
                            disabled={item.email === user?.email}
                          >
                            Delete
                          </Button>
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

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit account" : "Create account"}</CardTitle>
            <CardDescription>
              {editingId
                ? "Update login details and reset password."
                : "Add a new user account for workspace access."}
            </CardDescription>
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
                      <SelectValue>{ROLE_DEFINITIONS[form.appRole]?.label ?? form.appRole}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {APP_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_DEFINITIONS[role]?.label ?? role}
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
                        {TEAMS.map((team) => (
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
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          imageUrl: "",
                        }));
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition hover:bg-destructive hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
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

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      {editingId ? "Updating..." : "Creating..."}
                    </>
                  ) : editingId ? (
                    "Update account"
                  ) : (
                    "Create account"
                  )}
                </Button>
                {editingId && (
                  <Button type="button" variant="secondary" onClick={resetForm} className="w-full sm:w-auto">
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
