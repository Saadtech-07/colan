"use client";

import * as React from "react";
import { Crown, Pencil, Plus, Search, Shield, Trash2, UserCog, Users } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { ManageRoleDialog } from "@/components/features/manage-role-dialog";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
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
  const { access, workspaceRoles, refreshWorkspaceRoles, canManageRoles } =
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoles();
  }, [loadRoles]);

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

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (role: WorkspaceRole) => {
    setEditing(role);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await withLoading("role-delete", LOADING_PRESETS.removingAccount, async () => {
        const res = await fetch(`/api/roles/${deleteTarget.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error(await parseApiError(res));
      });
      showToast(`Role "${deleteTarget.name}" deleted.`);
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

      {canManageRoles && (
        <div className="flex justify-end">
          <Button className="gap-2 shadow-sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create role
          </Button>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <LoadingIndicator title="Loading Roles" className="py-12" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((role) => {
            const Icon = ROLE_ICONS[role.key] ?? Shield;
            const isCurrent = currentRoleKey === role.key;
            const modules = moduleAccessLabels(role);
            return (
              <Card
                key={role.id}
                className={cn(
                  "border-border/70 transition-all duration-200",
                  isCurrent
                    ? "border-primary/50 bg-primary/5 shadow-md ring-1 ring-primary/20"
                    : "hover:-translate-y-0.5 hover:shadow-md",
                )}
              >
                <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: role.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{role.name}</CardTitle>
                      {role.isSystem && (
                        <Badge variant="outline" className="text-[10px]">
                          System
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge className="text-[10px] uppercase">Your role</Badge>
                      )}
                    </div>
                    <CardDescription>{role.description}</CardDescription>
                  </div>
                  {canManageRoles && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(role)}
                        aria-label={`Edit ${role.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!role.isSystem && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(role)}
                          aria-label={`Delete ${role.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Permission matrix
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {modules.length === 0 ? (
                        <li className="text-xs text-muted-foreground">No permissions enabled</li>
                      ) : (
                        modules.map((m) => (
                          <li key={`${role.id}-${m.title}`}>
                            <Badge variant="secondary" className="font-normal">
                              {m.title} · {m.mode}
                            </Badge>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  {role.scopes.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Access scope
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {role.scopes.map((s) => (
                          <li key={s}>
                            <Badge variant="outline" className="font-normal">
                              {s}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No roles match your search.</p>
      )}

      <ManageRoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={async () => {
          showToast(editing ? "Role updated." : "Role created.");
          await loadRoles();
        }}
      />

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
