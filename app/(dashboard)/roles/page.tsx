"use client";

import * as React from "react";
import { Crown, Eye, MoreHorizontal, Pencil, Plus, Search, Shield, Trash2, UserCog, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ManageRoleDialog } from "@/components/features/manage-role-dialog";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import {
  MODULE_LABELS,
  RBAC_MODULES,
  getEnabledModuleActionLabels,
  moduleHasAnyAccess,
} from "@/lib/rbac-modules";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/models";
import { sectionTitleClassName } from "@/components/ui/page-typography";

const ROLE_ICONS: Record<string, typeof Crown> = {
  admin: Crown,
  manager: UserCog,
  lead: Shield,
  employee: Users,
};

function moduleAccessLabels(role: WorkspaceRole): { title: string; mode: string }[] {
  return RBAC_MODULES.filter((module) => moduleHasAnyAccess(role.permissions[module])).map(
    (module) => {
      const labels = getEnabledModuleActionLabels(module, role.permissions[module]);
      const actionSummary =
        role.permissions[module].manage
          ? "Full access"
          : labels.length <= 3
            ? labels.join(", ")
            : `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;

      return {
        title: MODULE_LABELS[module].title,
        mode: actionSummary,
      };
    },
  );
}

export default function RolesPage() {
  const { access, workspaceRoles, refreshWorkspaceRoles, removeWorkspaceRole, canManageRoles, dataLoading } =
    useAppState();
  const { withLoading } = useGlobalLoading();
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<WorkspaceRole | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<WorkspaceRole | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [viewAccessRole, setViewAccessRole] = React.useState<WorkspaceRole | null>(null);

  const loadRoles = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshWorkspaceRoles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, [refreshWorkspaceRoles]);

  React.useEffect(() => {
    if (dataLoading) return;
    // Roles already loaded for this route — skip duplicate /api/roles fetch.
    if (workspaceRoles.length > 0) {
      setLoading(false);
      return;
    }
    void loadRoles();
  }, [dataLoading, loadRoles, workspaceRoles.length]);

  const filtered = workspaceRoles.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.key.toLowerCase().includes(q)
    );
  });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const resolveRole = React.useCallback(
    (role: WorkspaceRole) => workspaceRoles.find((item) => item.id === role.id) ?? role,
    [workspaceRoles],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (role: WorkspaceRole) => {
    setEditing(resolveRole(role));
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    const deletedName = deleteTarget.name;
    setDeleting(true);
    try {
      await withLoading("role-delete", LOADING_PRESETS.removingAccount, async () => {
        const res = await fetch(`/api/roles/${deletedId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error(await parseApiError(res));
      });
      removeWorkspaceRole(deletedId);
      showToast(`Role "${deletedName}" deleted.`);
      setDeleteTarget(null);
      await loadRoles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const currentRoleKey = access?.role;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <PageLoadingShell
        loading={loading}
        title="Loading Roles"
        deferWhileWorkspaceBootstrapping
        centerInSection
        minLoadingHeight="0"
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles…"
                className="h-10 rounded-xl border-border/70 bg-background pl-9 shadow-sm transition-colors focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            {canManageRoles && (
              <Button className="h-10 shrink-0 gap-2 rounded-xl px-4 shadow-sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Create role
              </Button>
            )}
          </div>

          {!loading && (
            <>
              {filtered.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((role, index) => {
            const Icon = ROLE_ICONS[role.key] ?? Shield;
            const isCurrent = currentRoleKey === role.key;
            const modules = moduleAccessLabels(role);
            return (
              <Card
                key={role.id}
                style={
                  {
                    "--role-accent": role.color,
                    animationDelay: `${(index % 6) * 80}ms`,
                  } as React.CSSProperties
                }
                className={cn(
                  "group relative overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/90 shadow-[0_4px_24px_-10px_rgba(15,23,42,0.08)] transition-all duration-300 ease-out dashboard-reveal-up",
                  "hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--role-accent)_28%,#e2e8f0)] hover:shadow-[0_16px_40px_-18px_color-mix(in_srgb,var(--role-accent)_28%,transparent)]",
                  isCurrent &&
                    "border-[color-mix(in_srgb,var(--role-accent)_32%,#e2e8f0)] bg-gradient-to-br from-white via-[color-mix(in_srgb,var(--role-accent)_4%,white)] to-slate-50/80 ring-1 ring-[color-mix(in_srgb,var(--role-accent)_18%,transparent)]",
                )}
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-[0.12] blur-3xl transition-opacity duration-300 group-hover:opacity-[0.2]"
                  style={{ backgroundColor: role.color }}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--role-accent)_55%,transparent)] to-transparent"
                  aria-hidden
                />

                <CardHeader className="relative flex flex-row items-start gap-4 space-y-0 pb-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-slate-200/80"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${role.color} 14%, white)`,
                      color: role.color,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className={cn(sectionTitleClassName, "text-base sm:text-lg")}>
                        {role.name}
                      </CardTitle>
                      {role.isSystem && (
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/70 bg-background/70 text-[10px] font-medium uppercase tracking-wide"
                        >
                          System
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge
                          className="rounded-full border-0 text-[10px] uppercase"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${role.color} 12%, white)`,
                            color: role.color,
                          }}
                        >
                          Your role
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                      {role.description}
                    </CardDescription>
                  </div>

                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-lg border border-slate-200/80 bg-white shadow-sm hover:bg-slate-50"
                          aria-label={`Actions for ${role.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                        <DropdownMenuItem
                          className="rounded-lg gap-2"
                          onClick={() => setViewAccessRole(resolveRole(role))}
                        >
                          <Eye className="h-4 w-4" />
                          View access
                        </DropdownMenuItem>
                        {canManageRoles && (
                          <>
                            <DropdownMenuItem
                              className="rounded-lg gap-2"
                              onClick={() => openEdit(role)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {!role.isSystem && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="rounded-lg gap-2 text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(role)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>

                <CardContent className="relative pt-0">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-slate-600">
                      {role.key}
                    </span>
                    <span className="tabular-nums">
                      {modules.length} module{modules.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">No roles match your search.</p>
              )}
            </>
          )}
        </div>
      </PageLoadingShell>

      <ManageRoleDialog
        key={editing ? `role-${editing.id}` : "role-new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={async (savedRole) => {
          showToast(editing ? "Role updated." : "Role created.");
          await loadRoles();
          setEditing(savedRole);
        }}
      />

      <Dialog open={!!viewAccessRole} onOpenChange={(open) => !open && setViewAccessRole(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {viewAccessRole && (
            <>
              <DialogHeader>
                <DialogTitle>{resolveRole(viewAccessRole).name} access</DialogTitle>
                <DialogDescription>
                  {resolveRole(viewAccessRole).description ||
                    "Module permissions assigned to this role."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Modules
                  </p>
                  <ul className="space-y-2">
                    {moduleAccessLabels(resolveRole(viewAccessRole)).length === 0 ? (
                      <li className="text-sm text-muted-foreground">No permissions enabled.</li>
                    ) : (
                      moduleAccessLabels(resolveRole(viewAccessRole)).map((entry) => (
                        <li
                          key={`${viewAccessRole.id}-${entry.title}`}
                          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5"
                        >
                          <span className="text-sm font-medium text-foreground">{entry.title}</span>
                          <span className="text-right text-xs text-muted-foreground">{entry.mode}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                {resolveRole(viewAccessRole).scopes.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Scope
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {resolveRole(viewAccessRole).scopes.map((scope) => (
                        <li key={scope}>
                          <Badge variant="outline" className="rounded-full font-normal">
                            {scope}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter>
                {canManageRoles && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      const role = viewAccessRole;
                      setViewAccessRole(null);
                      openEdit(role);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit access
                  </Button>
                )}
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => setViewAccessRole(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              Users assigned this role must be updated first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
