"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CircleCheckBig,
  ImagePlus,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { roleNeedsTeam } from "@/lib/permissions";
import type { AppRole, TeamName } from "@/types";
import type { AppUserPublicDTO } from "@/models/app-user.model";

type AppUserFormState = {
  email: string;
  name: string;
  password: string;
  employeeId: string;
  appRole: AppRole;
  team: TeamName;
  imageUrl: string;
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

const FALLBACK_TEAM = "React Team" as TeamName;

function buildInitialForm(defaultTeam: TeamName): AppUserFormState {
  return {
    email: "",
    name: "",
    password: "",
    employeeId: "",
    appRole: "employee",
    team: defaultTeam,
    imageUrl: "",
  };
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  if (!source) return "AU";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function profileStatusMeta(isProfileCompleted: boolean) {
  if (isProfileCompleted) {
    return {
      label: "Profile Complete",
      variant: "success" as const,
    };
  }

  return {
    label: "Setup Pending",
    variant: "warning" as const,
  };
}

export default function AppUsersPage() {
  const router = useRouter();
  const { isAdmin, user, refreshData, teamNames, workspaceRoles } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();

  const defaultTeam = (teamNames[0] ?? FALLBACK_TEAM) as TeamName;

  const [users, setUsers] = React.useState<AppUserPublicDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<CreateAccountToast | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<AppUserFormState>(() =>
    buildInitialForm(FALLBACK_TEAM),
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [teamFilter, setTeamFilter] = React.useState("all");
  const [dragActive, setDragActive] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const blobPreviewRef = React.useRef<string | null>(null);

  const submitting = isLoadingKey("app-users-submit");
  const showTeamField = roleNeedsTeam(form.appRole);

  const roleNameMap = React.useMemo(
    () => new Map(workspaceRoles.map((role) => [role.key, role.name])),
    [workspaceRoles],
  );

  const getRoleLabel = React.useCallback(
    (roleKey: AppRole) => roleNameMap.get(roleKey) ?? roleKey,
    [roleNameMap],
  );

  const availableTeamFilters = React.useMemo(() => {
    const items = new Set<string>(teamNames);
    if (users.some((item) => !item.team)) {
      items.add("Unassigned");
    }
    return [...items];
  }, [teamNames, users]);

  const filteredUsers = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((record) => {
      if (roleFilter !== "all" && record.appRole !== roleFilter) {
        return false;
      }

      const recordTeam = record.team ?? "Unassigned";
      if (teamFilter !== "all" && recordTeam !== teamFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        record.email,
        record.name,
        record.employeeId,
        getRoleLabel(record.appRole),
        record.team ?? "Unassigned",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [getRoleLabel, roleFilter, searchQuery, teamFilter, users]);

  const summary = React.useMemo(() => {
    const completedProfiles = users.filter((record) => record.isProfileCompleted).length;
    const representedTeams = new Set(users.map((record) => record.team).filter(Boolean)).size;

    return {
      total: users.length,
      completedProfiles,
      representedTeams,
    };
  }, [users]);

  const clearBlobPreview = React.useCallback(() => {
    if (blobPreviewRef.current) {
      URL.revokeObjectURL(blobPreviewRef.current);
      blobPreviewRef.current = null;
    }
  }, []);

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
      clearBlobPreview();
    },
    [clearBlobPreview],
  );

  const resetForm = React.useCallback(
    (opts?: { clearFeedback?: boolean }) => {
      clearBlobPreview();
      setEditingId(null);
      setForm(buildInitialForm(defaultTeam));
      setDragActive(false);
      if (opts?.clearFeedback !== false) {
        setSuccess(null);
        setError(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [clearBlobPreview, defaultTeam],
  );

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !submitting) {
      resetForm();
    }
    setDialogOpen(nextOpen);
  };

  const applyImageFile = React.useCallback(
    (file: File | null) => {
      if (!file) return;
      clearBlobPreview();
      const localImageUrl = URL.createObjectURL(file);
      blobPreviewRef.current = localImageUrl;
      setForm((prev) => ({
        ...prev,
        imageUrl: localImageUrl,
      }));
      setDragActive(false);
    },
    [clearBlobPreview],
  );

  const removeImage = React.useCallback(() => {
    clearBlobPreview();
    setForm((prev) => ({
      ...prev,
      imageUrl: "",
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [clearBlobPreview]);

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setTeamFilter("all");
  };

  const startCreate = () => {
    resetForm();
    setDialogOpen(true);
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

        setDialogOpen(false);
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
        if (editingId === id) {
          setDialogOpen(false);
          resetForm({ clearFeedback: false });
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete account.");
    }
  };

  const startEdit = (userRecord: AppUserPublicDTO) => {
    clearBlobPreview();
    setEditingId(userRecord.id);
    setForm({
      email: userRecord.email,
      name: userRecord.name,
      password: "",
      employeeId: userRecord.employeeId ?? "",
      appRole: userRecord.appRole,
      team: userRecord.team ?? defaultTeam,
      imageUrl: userRecord.imageUrl ?? "",
    });
    setSuccess(null);
    setError(null);
    setDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="rounded-[32px] border border-border/70 bg-card p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
          <ShieldCheck className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Access denied</h1>
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

      <section className="overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <Badge
              variant="muted"
              className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
            >
              Workspace access
            </Badge>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                App Users
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Manage login accounts, workspace roles, and employee access in a cleaner
                admin workspace. Open the account modal whenever you need to create or
                edit access.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-2xl font-semibold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total accounts</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-2xl font-semibold">{summary.completedProfiles}</p>
                <p className="text-xs text-muted-foreground">Profiles completed</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-2xl font-semibold">{summary.representedTeams}</p>
                <p className="text-xs text-muted-foreground">Teams represented</p>
              </div>
            </div>
          </div>

          <div className="w-full xl:max-w-sm">
            <div className="space-y-3 rounded-[28px] border border-border/60 bg-background/85 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Signed in as</p>
                  <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Keep the directory on the page and handle account creation or editing in a
                focused popup flow.
              </p>
              <Button
                type="button"
                className="h-11 w-full rounded-2xl px-5 shadow-sm"
                onClick={startCreate}
              >
                <Plus className="h-4 w-4" />
                Create Account
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error && !submitting && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && !submitting && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          {success}
        </div>
      )}

      <Card className="overflow-hidden rounded-[28px] border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-card/70 pb-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-xl">Account directory</CardTitle>
                <CardDescription className="mt-1">
                  Search, filter, and manage workspace accounts from one place.
                </CardDescription>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Showing {filteredUsers.length} of {users.length}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name, email, employee ID, role, or team"
                  className="h-11 rounded-2xl border-border/70 pl-10"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/60">
                  <SelectItem value="all">All roles</SelectItem>
                  {workspaceRoles.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85">
                  <SelectValue placeholder="Filter by team" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/60">
                  <SelectItem value="all">All teams</SelectItem>
                  {availableTeamFilters.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-border/70 bg-background/80 px-4"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`account-skeleton-${index}`}
                  className="animate-pulse rounded-[24px] border border-border/70 bg-muted/25 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 rounded bg-muted" />
                      <div className="h-3 w-56 rounded bg-muted" />
                      <div className="h-3 w-32 rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background shadow-sm">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No matching accounts</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search term or reset the active filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((record) => {
                const status = profileStatusMeta(record.isProfileCompleted);
                const isCurrentUser = record.email === user?.email;
                const isEditing = editingId === record.id && dialogOpen;

                return (
                  <article
                    key={record.id}
                    className={cn(
                      "rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                      isEditing && "border-primary/30 bg-primary/5 shadow-md",
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <Avatar className="h-14 w-14 rounded-2xl ring-0">
                          <AvatarImage src={record.imageUrl} alt={record.name} />
                          <AvatarFallback className="rounded-2xl text-sm font-semibold">
                            {getInitials(record.name, record.email)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold leading-none">
                              {record.name}
                            </h3>
                            {isCurrentUser && (
                              <Badge
                                variant="muted"
                                className="rounded-full bg-muted/70 px-2.5 py-1 text-[11px]"
                              >
                                You
                              </Badge>
                            )}
                            {isEditing && (
                              <Badge className="rounded-full px-2.5 py-1 text-[11px]">
                                Editing
                              </Badge>
                            )}
                            <Badge
                              variant={status.variant}
                              className="rounded-full px-2.5 py-1 text-[11px]"
                            >
                              {status.label}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="h-4 w-4" />
                              {record.email}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldCheck className="h-4 w-4" />
                              {getRoleLabel(record.appRole)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="h-4 w-4" />
                              {record.team ?? "Unassigned"}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant="secondary"
                              className="rounded-full bg-secondary/70 px-3 py-1"
                            >
                              {getRoleLabel(record.appRole)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="rounded-full border-border/70 bg-background/70 px-3 py-1"
                            >
                              Team: {record.team ?? "Unassigned"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="rounded-full border-border/70 bg-background/70 px-3 py-1"
                            >
                              ID: {record.employeeId}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full bg-background/80 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          onClick={() => startEdit(record)}
                          aria-label={`Edit ${record.email}`}
                          title="Edit account"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full bg-background/80 text-destructive transition hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(record.id, record.email)}
                          disabled={isCurrentUser}
                          aria-label={`Delete ${record.email}`}
                          title={
                            isCurrentUser
                              ? "You cannot delete your own account"
                              : "Delete account"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-hidden border-border/70 bg-background/95 p-0 sm:max-w-3xl">
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b border-border/60 px-6 py-5">
              <Badge
                variant={editingId ? "warning" : "muted"}
                className={cn(
                  "w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]",
                  !editingId &&
                    "border border-border/60 bg-background/80 text-muted-foreground",
                )}
              >
                {editingId ? "Editing account" : "Create workspace account"}
              </Badge>
              <DialogTitle className="mt-3 text-xl">
                {editingId ? "Edit account" : "Create account"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {editingId
                  ? "Update account access, workspace role, and employee details."
                  : "Create a new login account for workspace access and assign the right role."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Identity
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Account details
                    </h3>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, email: event.target.value }))
                        }
                        disabled={!!editingId}
                        className="h-11 rounded-2xl border-border/70"
                      />
                      {editingId && (
                        <p className="text-xs text-muted-foreground">
                          Email remains fixed after account creation.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        className="h-11 rounded-2xl border-border/70"
                        placeholder="Full name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="employee-id">Employee ID</Label>
                      <Input
                        id="employee-id"
                        value={form.employeeId}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            employeeId: event.target.value,
                          }))
                        }
                        placeholder="COL-1001"
                        className="h-11 rounded-2xl border-border/70"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Access
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Role and team
                    </h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={form.appRole}
                        onValueChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            appRole: value as AppRole,
                          }))
                        }
                      >
                        <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85">
                          <SelectValue>
                            {workspaceRoles.find((role) => role.key === form.appRole)?.name ??
                              form.appRole}
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

                    {showTeamField && (
                      <div className="space-y-2">
                        <Label>Team</Label>
                        <Select
                          value={form.team}
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, team: value as TeamName }))
                          }
                        >
                          <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85">
                            <SelectValue>{form.team}</SelectValue>
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
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Security
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Password
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      placeholder={
                        editingId
                          ? "Leave blank to keep current password"
                          : "Set a password"
                      }
                      className="h-11 rounded-2xl border-border/70"
                    />
                    <p className="text-xs text-muted-foreground">
                      {editingId
                        ? "Only enter a new password if you want to replace the current one."
                        : "A minimum of 6 characters is required for new accounts."}
                    </p>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Employee image
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Upload and preview
                    </h3>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      applyImageFile(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className={cn(
                      "rounded-[24px] border border-dashed p-4 transition-all",
                      dragActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/70 bg-muted/20 hover:border-primary/40 hover:bg-muted/35",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
                        {form.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- existing module stores raw image URL strings for account records
                          <img
                            src={form.imageUrl}
                            alt="Employee preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImagePlus className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {form.imageUrl
                            ? "Image selected and ready"
                            : "Upload employee image"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Drag and drop an image here or click to choose a file.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          PNG, JPG, or JPEG preview supported.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        applyImageFile(event.target.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                    />

                    <div className="text-xs text-muted-foreground">
                      {form.imageUrl
                        ? "Preview available in the account form."
                        : "No image selected yet."}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl border-border/70 bg-background/80"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Choose image
                      </Button>
                      {form.imageUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="rounded-2xl text-muted-foreground"
                          onClick={removeImage}
                        >
                          <X className="h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </section>
              </form>
            </div>

            <DialogFooter className="border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur sm:justify-between">
              <div className="text-xs leading-5 text-muted-foreground">
                {editingId
                  ? "Changes apply to the existing login account and linked workspace profile."
                  : "Creating an account will also provision the linked employee access record."}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-border/70 bg-background/80"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  {editingId ? "Cancel Edit" : "Cancel"}
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-2xl px-5 shadow-sm"
                  disabled={submitting}
                  onClick={() => formRef.current?.requestSubmit()}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : editingId ? (
                    <Save className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {editingId ? "Save Changes" : "Create Account"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
