"use client";

import * as React from "react";
import { Plus, Trash2, UserCheck } from "lucide-react";
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
import { useAppState } from "@/providers/app-state";
import { ROLE_DEFINITIONS, APP_ROLES, roleNeedsTeam } from "@/lib/permissions";
import { TEAMS } from "@/lib/constants";
import type { AppRole, TeamName } from "@/types";
import type { AppUserPublicDTO } from "@/models/app-user.model";

const initialFormState = {
  email: "",
  name: "",
  password: "",
  appRole: "employee" as AppRole,
  team: "React Team" as TeamName,
  imageUrl: "",
};

export default function AppUsersPage() {
  const { isAdmin, user } = useAppState();
  const [users, setUsers] = React.useState<AppUserPublicDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(initialFormState);

  const activeRoleLabel = ROLE_DEFINITIONS[form.appRole]?.label ?? "Employee";
  const showTeamField = roleNeedsTeam(form.appRole);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app-users", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setUsers((await res.json()) as AppUserPublicDTO[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

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

    try {
      const endpoint = editingId ? `/api/app-users/${editingId}` : "/api/app-users";
      const method = editingId ? "PATCH" : "POST";
      const body = {
        name: form.name,
        appRole: form.appRole,
        team: showTeamField ? form.team : undefined,
        imageUrl: form.imageUrl || undefined,
        ...(editingId ? {} : { email: form.email.toLowerCase(), password: form.password }),
        ...(editingId && form.password ? { password: form.password } : {}),
      };
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || res.statusText);
      }
      await fetchUsers();
      setSuccess(editingId ? "Account updated successfully." : "Account created successfully.");
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save account.");
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete account ${email}? This cannot be undone.`)) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/app-users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || res.statusText);
      }
      await fetchUsers();
      setSuccess("Account removed.");
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
                  {loading ? "Loading accounts..." : `${users.length} account(s) available.`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            {error && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
                {success}
              </div>
            )}
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
                      <td className="px-4 py-4 align-top">{ROLE_DEFINITIONS[item.appRole]?.label ?? item.appRole}</td>
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
                  {users.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit account" : "Create account"}</CardTitle>
            <CardDescription>
              {editingId ? "Update login details and reset password." : "Add a new user account for workspace access."}
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

              <div className="space-y-3">
                <Label htmlFor="imageUrl">Avatar URL</Label>
                <Input
                  id="imageUrl"
                  type="url"
                  value={form.imageUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                  placeholder="Optional avatar image URL"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" className="w-full sm:w-auto">
                  {editingId ? "Update account" : "Create account"}
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
