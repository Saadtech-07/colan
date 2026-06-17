"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CircleCheckBig,
  Mail,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  ConfirmDeleteDialog,
  type ConfirmDeleteTarget,
} from "@/components/features/confirm-delete-dialog";
import {
  buildDefaultAppUserForm,
  buildFormFromAppUserRecord,
  type AppUserAccountFormValues,
} from "@/components/features/app-user-account-form-fields";
import {
  CreateAppUserWizardDialog,
  type AccountSetupForm,
} from "@/components/features/create-app-user-wizard-dialog";
import { EditAppUserDialog } from "@/components/features/edit-app-user-dialog";
import { UNASSIGNED_SEAT } from "@/components/features/app-user-account-form-fields";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { profileNameInitial } from "@/lib/profile-image";
import { useClientPagination } from "@/lib/client-pagination";
import { ListPagination } from "@/components/ui/list-pagination";
import { cn } from "@/lib/utils";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { roleNeedsEmployeeIdentity } from "@/lib/permissions";
import { resolveAppUserFromQuery } from "@/lib/app-user-navigation";
import type { AppRole, TeamName } from "@/types";
import type { AppUserPublicDTO } from "@/models/app-user.model";

type AppUserFormState = AppUserAccountFormValues;

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
const APP_USERS_PAGE_SIZE = 4;

function buildInitialForm(defaultTeam: TeamName): AppUserFormState {
  return buildDefaultAppUserForm(defaultTeam);
}

function findLinkedEmployeeId(
  userRecord: AppUserPublicDTO,
  employees: ReturnType<typeof useAppState>["employees"],
) {
  const email = userRecord.email.toLowerCase();
  return employees.find(
    (employee) =>
      employee.directory?.workEmail?.toLowerCase() === email ||
      employee.employeeId.toLowerCase() === userRecord.employeeId?.toLowerCase(),
  )?.id;
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
  const searchParams = useSearchParams();
  const { isAdmin, user, refreshData, teamNames, workspaceRoles, employees } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();

  const defaultTeam = (teamNames[0] ?? FALLBACK_TEAM) as TeamName;

  const [users, setUsers] = React.useState<AppUserPublicDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<CreateAccountToast | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [createWizardOpen, setCreateWizardOpen] = React.useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<string | undefined>(
    undefined,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<ConfirmDeleteTarget | null>(null);
  const [form, setForm] = React.useState<AppUserFormState>(() =>
    buildInitialForm(FALLBACK_TEAM),
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [teamFilter, setTeamFilter] = React.useState("all");

  const toastTimerRef = React.useRef<number | null>(null);
  const openedFromQueryRef = React.useRef(false);

  const submitting = isLoadingKey("app-users-submit");
  const showEmployeeIdentityFields = roleNeedsEmployeeIdentity(form.appRole);

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

  const {
    page,
    setPage,
    pageItems: paginatedUsers,
    totalPages,
    totalItems: paginatedTotal,
    rangeStart,
    rangeEnd,
  } = useClientPagination(filteredUsers, APP_USERS_PAGE_SIZE, [
    searchQuery,
    roleFilter,
    teamFilter,
  ]);

  const summary = React.useMemo(() => {
    const completedProfiles = users.filter((record) => record.isProfileCompleted).length;
    const representedTeams = new Set(users.map((record) => record.team).filter(Boolean)).size;

    return {
      total: users.length,
      completedProfiles,
      representedTeams,
    };
  }, [users]);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app-users", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
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

  const resetForm = React.useCallback(
    (opts?: { clearFeedback?: boolean }) => {
      setEditingId(null);
      setEditingEmployeeId(undefined);
      setForm(buildInitialForm(defaultTeam));
      if (opts?.clearFeedback !== false) {
        setSuccess(null);
        setError(null);
      }
    },
    [defaultTeam],
  );

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !submitting) {
      resetForm();
    }
    setDialogOpen(nextOpen);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setTeamFilter("all");
  };

  const startCreate = () => {
    setError(null);
    setSuccess(null);
    setCreateWizardOpen(true);
  };

  const handleCreateAccount = async (account: AccountSetupForm) => {
    setError(null);
    setSuccess(null);

    await withLoading("app-users-submit", LOADING_PRESETS.creatingAccount, async () => {
      const body = {
        email: account.email.trim().toLowerCase(),
        name: account.name.trim(),
        appRole: account.appRole,
        ...(roleNeedsEmployeeIdentity(account.appRole)
          ? {
              employeeId: account.employeeId.trim(),
              team: account.team,
            }
          : {}),
        password: account.password.trim(),
        ...(account.imageUrl.trim() ? { imageUrl: account.imageUrl.trim() } : {}),
        workEmail: account.workEmail.trim() || account.email.trim().toLowerCase(),
        phone: account.phone.trim() || undefined,
        currentAddress: account.currentAddress.trim() || undefined,
        permanentAddress: account.permanentAddress.trim() || undefined,
        joinedDate: account.joinedDate.trim() || undefined,
        gender: account.gender,
        bayNumber:
          account.bayNumber && account.bayNumber !== UNASSIGNED_SEAT
            ? account.bayNumber
            : undefined,
      };

      const res = await fetch("/api/app-users", {
        method: "POST",
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
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    setError(null);
    setSuccess(null);

    const preset = LOADING_PRESETS.updatingAccount;

    try {
      await withLoading("app-users-submit", preset, async () => {
        const body = {
          name: form.name.trim(),
          appRole: form.appRole,
          ...(showEmployeeIdentityFields
            ? {
                team: form.team,
                employeeId: form.employeeId.trim(),
                bayNumber:
                  form.bayNumber && form.bayNumber !== UNASSIGNED_SEAT
                    ? form.bayNumber
                    : UNASSIGNED_SEAT,
              }
            : {}),
          workEmail: form.workEmail.trim() || form.email.trim(),
          phone: form.phone.trim() || undefined,
          currentAddress: form.currentAddress.trim() || undefined,
          permanentAddress: form.permanentAddress.trim() || undefined,
          joinedDate: form.joinedDate.trim() || undefined,
          gender: form.gender,
          ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
          ...(form.password ? { password: form.password } : {}),
        };

        const res = await fetch(`/api/app-users/${editingId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await parseApiError(res));
        }

        await res.json();
        await fetchUsers();
        await refreshData();

        setDialogOpen(false);
        resetForm({ clearFeedback: false });
        setSuccess("Account updated successfully.");
      });
    } catch (e) {
      throw e;
    }
  };

  const deleting = isLoadingKey("app-users-delete");

  const requestDelete = (record: AppUserPublicDTO) => {
    setDeleteTarget({
      id: record.id,
      email: record.email,
      name: record.name,
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
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
        setSuccess("Account removed.");
        setDeleteTarget(null);
        if (editingId === id) {
          setDialogOpen(false);
          resetForm({ clearFeedback: false });
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete account.");
    }
  };

  const startEdit = React.useCallback(
    (userRecord: AppUserPublicDTO) => {
      setEditingId(userRecord.id);
      setEditingEmployeeId(findLinkedEmployeeId(userRecord, employees));
      setForm(
        buildFormFromAppUserRecord({
          email: userRecord.email,
          name: userRecord.name,
          employeeId: userRecord.employeeId,
          appRole: userRecord.appRole,
          team: userRecord.team,
          defaultTeam,
          workEmail: userRecord.workEmail,
          phone: userRecord.phone,
          location: userRecord.location,
          fullAddress: userRecord.fullAddress,
          currentAddress: userRecord.currentAddress,
          permanentAddress: userRecord.permanentAddress,
          joinedDate: userRecord.joinedDate,
          bayNumber: userRecord.bayNumber,
          gender: (userRecord.gender as AppUserFormState["gender"]) ?? "male",
          imageUrl: userRecord.imageUrl,
        }),
      );
      setSuccess(null);
      setError(null);
      setDialogOpen(true);
    },
    [defaultTeam, employees],
  );

  React.useEffect(() => {
    if (!isAdmin || loading || openedFromQueryRef.current) return;

    const editId = searchParams.get("edit");
    const employeeId = searchParams.get("employeeId");
    if (!editId && !employeeId) return;
    if (users.length === 0) return;

    const target = resolveAppUserFromQuery(users, employees, { editId, employeeId });
    if (!target) return;

    openedFromQueryRef.current = true;
    startEdit(target);
    router.replace("/app-users", { scroll: false });
  }, [employees, isAdmin, loading, router, searchParams, startEdit, users]);

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
                {paginatedTotal === 0
                  ? `Showing 0 of ${users.length}`
                  : totalPages > 1
                    ? `Showing ${rangeStart}–${rangeEnd} of ${paginatedTotal} (${users.length} total)`
                    : `Showing ${paginatedTotal} of ${users.length}`}
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
              {paginatedUsers.map((record) => {
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
                            {profileNameInitial(record.name, record.email)}
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
                          onClick={() => requestDelete(record)}
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
              <ListPagination
                page={page}
                totalPages={totalPages}
                totalItems={paginatedTotal}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        target={deleteTarget}
        onConfirm={confirmDelete}
        loading={deleting}
      />

      <CreateAppUserWizardDialog
        open={createWizardOpen}
        onOpenChange={setCreateWizardOpen}
        defaultTeam={defaultTeam}
        teamNames={teamNames}
        workspaceRoles={workspaceRoles}
        users={users}
        employees={employees}
        submitting={submitting}
        onSubmit={handleCreateAccount}
      />

      <EditAppUserDialog
        open={dialogOpen && !!editingId}
        onOpenChange={handleDialogOpenChange}
        values={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        workspaceRoles={workspaceRoles}
        teamNames={teamNames}
        defaultTeam={defaultTeam}
        employees={employees}
        editingEmployeeId={editingEmployeeId}
        submitting={submitting}
        onSubmit={() => {
          void handleSaveEdit().catch((e) => {
            setError(e instanceof Error ? e.message : "Unable to save account.");
          });
        }}
      />
    </div>
  );
}
