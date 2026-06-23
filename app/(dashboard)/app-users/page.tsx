"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CircleCheckBig,
  Mail,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  ConfirmDeleteDialog,
  type ConfirmDeleteTarget,
} from "@/components/features/confirm-delete-dialog";
import { CreateAppUserTrigger } from "@/components/features/create-app-user-trigger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import { SectionTitle } from "@/components/ui/page-typography";
import { cn } from "@/lib/utils";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { consumeCreateAccountToast } from "@/lib/create-app-user-client";
import { consumeEditAccountSuccess } from "@/lib/edit-app-user-client";
import { getCachedAppUsers, setCachedAppUsers } from "@/lib/app-users-page-cache";
import { resolveAppUserFromQuery } from "@/lib/app-user-navigation";
import type { AppRole, TeamName } from "@/types";
import type { AppUserPublicDTO } from "@/models/app-user.model";

type CreateAccountToast = {
  variant: "success" | "warning";
  title: string;
  description: string;
};

const APP_USERS_PAGE_SIZE = 6;

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin, user, refreshData, teamNames, workspaceRoles, employees, dataLoading } =
    useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();

  const [users, setUsers] = React.useState<AppUserPublicDTO[]>(
    () => getCachedAppUsers() ?? [],
  );
  const [loading, setLoading] = React.useState(() => getCachedAppUsers() === null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<CreateAccountToast | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ConfirmDeleteTarget | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [teamFilter, setTeamFilter] = React.useState("all");

  const toastTimerRef = React.useRef<number | null>(null);
  const successTimerRef = React.useRef<number | null>(null);
  const openedFromQueryRef = React.useRef(false);

  const deleting = isLoadingKey("app-users-delete");

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

  const getRoleMeta = React.useCallback(
    (roleKey: AppRole) => workspaceRoles.find((role) => role.key === roleKey),
    [workspaceRoles],
  );

  const fetchUsers = React.useCallback(async (options?: { silent?: boolean }) => {
    const hasCachedData = getCachedAppUsers() !== null;
    if (!options?.silent && !hasCachedData) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch("/api/app-users", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      const data = (await res.json()) as AppUserPublicDTO[];
      setUsers(data);
      setCachedAppUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isAdmin || dataLoading) return;
    const timer = window.setTimeout(() => {
      void fetchUsers({ silent: getCachedAppUsers() !== null });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchUsers, isAdmin, dataLoading]);

  const showToast = React.useCallback((next: CreateAccountToast) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(next);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2000);
  }, []);

  const showSuccessMessage = React.useCallback((message: string) => {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    setSuccess(message);
    successTimerRef.current = window.setTimeout(() => {
      setSuccess(null);
      successTimerRef.current = null;
    }, 4000);
  }, []);

  React.useEffect(() => {
    const pending = consumeCreateAccountToast();
    if (pending) {
      showToast(pending);
      void fetchUsers({ silent: true });
      return;
    }

    const editSuccess = consumeEditAccountSuccess();
    if (editSuccess) {
      showSuccessMessage(editSuccess);
      void fetchUsers({ silent: true });
    }
  }, [fetchUsers, showSuccessMessage, showToast]);

  React.useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    },
    [],
  );

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setTeamFilter("all");
  };

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
        await fetchUsers({ silent: true });
        await refreshData();
        showSuccessMessage("Account removed.");
        setDeleteTarget(null);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete account.");
    }
  };

  const openEdit = React.useCallback(
    (userRecord: AppUserPublicDTO) => {
      router.push(`/app-users/${userRecord.id}/edit`);
    },
    [router],
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
    router.replace(`/app-users/${target.id}/edit`, { scroll: false });
  }, [employees, isAdmin, loading, router, searchParams, users]);

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

      {error && !deleting && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && !deleting && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          <span>{success}</span>
          <button
            type="button"
            className="rounded-md p-1 text-primary/70 transition hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
              setSuccess(null);
            }}
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <PageLoadingShell
        loading={loading}
        title={LOADING_PRESETS.loadingAccounts.title}
        description={LOADING_PRESETS.loadingAccounts.description}
        deferWhileWorkspaceBootstrapping
        centerInSection
        minLoadingHeight="0"
      >
        <div className="space-y-4">
        <SectionTitle as="h2" className="font-semibold text-muted-foreground">
          Account directory
        </SectionTitle>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name, email, employee ID, role, or team"
                className="h-10 rounded-xl border-border/70 bg-background pl-9 shadow-sm focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background sm:w-[150px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/60">
                <SelectItem value="all">All roles</SelectItem>
                {workspaceRoles.map((role) => (
                  <SelectItem key={role.key} value={role.key}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background sm:w-[150px]">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/60">
                <SelectItem value="all">All teams</SelectItem>
                {availableTeamFilters.map((team) => (
                  <SelectItem key={team} value={team}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchQuery || roleFilter !== "all" || teamFilter !== "all") && (
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 rounded-xl px-3 text-sm"
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}
          </div>

          <CreateAppUserTrigger />
        </div>

      <Card className="overflow-hidden rounded-[28px] border-border/70 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          {!loading ? (
            filteredUsers.length === 0 ? (
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
                const isEditing = pathname === `/app-users/${record.id}/edit`;
                const roleMeta = getRoleMeta(record.appRole);

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
                              <Building2 className="h-4 w-4" />
                              {record.team ?? "Unassigned"}
                            </span>
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                              ID: {record.employeeId}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge
                              className="rounded-full border-0 px-3 py-1 text-[11px] font-medium"
                              style={
                                roleMeta
                                  ? {
                                      backgroundColor: `color-mix(in srgb, ${roleMeta.color} 12%, white)`,
                                      color: roleMeta.color,
                                    }
                                  : undefined
                              }
                              variant={roleMeta ? "secondary" : "secondary"}
                            >
                              {getRoleLabel(record.appRole)}
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
                          onClick={() => openEdit(record)}
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
            )
          ) : null}
        </CardContent>
      </Card>
        </div>
      </PageLoadingShell>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        target={deleteTarget}
        onConfirm={confirmDelete}
        loading={deleting}
      />

    </div>
  );
}
