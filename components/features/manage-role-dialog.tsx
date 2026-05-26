"use client";

import * as React from "react";
import { Search, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { PermissionGrid } from "@/components/features/permission-grid";
import {
  emptyModulePermissions,
  getModuleActionConfigs,
  RBAC_MODULES,
  normalizeModulePermissions,
  type ModulePermissionsMap,
} from "@/lib/rbac-modules";
import { parseApiError } from "@/providers/app-state";
import type { WorkspaceRole } from "@/models";

const COLOR_PRESETS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#64748b",
];

const PRESETS = [
  {
    id: "full-access",
    label: "Full Access",
    description: "Enable manage access across every module.",
  },
  {
    id: "read-only",
    label: "Read Only",
    description: "Enable view access only across the workspace.",
  },
  {
    id: "team-management",
    label: "Team Management",
    description: "Projects, members, seating, and gallery operations for delivery leads.",
  },
  {
    id: "workspace-control",
    label: "Workspace Control",
    description: "Admin-style control over workspace operations and permissions.",
  },
  {
    id: "limited-access",
    label: "Limited Access",
    description: "Basic visibility across common workspace modules.",
  },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: WorkspaceRole | null;
  onSaved: (role: WorkspaceRole) => void;
};

function initialDialogPermissions(editing: WorkspaceRole | null): ModulePermissionsMap {
  return editing
    ? normalizeModulePermissions(editing.permissions)
    : emptyModulePermissions();
}

function setActions(
  base: ModulePermissionsMap,
  module: (typeof RBAC_MODULES)[number],
  actionKeys: string[],
  options?: { manage?: boolean; view?: boolean },
) {
  const next = normalizeModulePermissions(base);
  const actions = { ...next[module].actions };
  for (const action of getModuleActionConfigs(module)) {
    actions[action.key] = actionKeys.includes(action.key);
  }
  next[module] = {
    view: options?.manage ? true : (options?.view ?? actionKeys.length > 0),
    manage: !!options?.manage,
    actions,
  };
  return next;
}

function applyPreset(id: (typeof PRESETS)[number]["id"]): ModulePermissionsMap {
  let next = emptyModulePermissions();

  switch (id) {
    case "full-access":
      for (const rbacModule of RBAC_MODULES) {
        next = setActions(
          next,
          rbacModule,
          getModuleActionConfigs(rbacModule).map((action) => action.key),
          { manage: true, view: true },
        );
      }
      return next;

    case "read-only":
      for (const rbacModule of RBAC_MODULES) {
        next = setActions(next, rbacModule, [], { view: true });
      }
      return next;

    case "team-management":
      next = setActions(next, "dashboard", ["analytics"], { view: true });
      next = setActions(next, "projects", ["create", "edit", "assign", "changeStatus"], {
        view: true,
      });
      next = setActions(
        next,
        "teamMembers",
        ["create", "edit", "assignProjects", "export"],
        { view: true },
      );
      next = setActions(next, "seating", ["assignSeats"], { view: true });
      next = setActions(next, "gallery", ["upload", "edit"], { view: true });
      next = setActions(next, "roles", [], { view: true });
      next = setActions(next, "appUsers", [], { view: false });
      return next;

    case "workspace-control":
      next = setActions(next, "dashboard", ["analytics", "export"], {
        manage: true,
        view: true,
      });
      next = setActions(
        next,
        "projects",
        getModuleActionConfigs("projects").map((action) => action.key),
        { manage: true, view: true },
      );
      next = setActions(
        next,
        "teamMembers",
        getModuleActionConfigs("teamMembers").map((action) => action.key),
        { manage: true, view: true },
      );
      next = setActions(
        next,
        "seating",
        getModuleActionConfigs("seating").map((action) => action.key),
        { manage: true, view: true },
      );
      next = setActions(
        next,
        "gallery",
        getModuleActionConfigs("gallery").map((action) => action.key),
        { manage: true, view: true },
      );
      next = setActions(
        next,
        "roles",
        getModuleActionConfigs("roles").map((action) => action.key),
        { manage: true, view: true },
      );
      next = setActions(
        next,
        "appUsers",
        getModuleActionConfigs("appUsers").map((action) => action.key),
        { manage: true, view: true },
      );
      return next;

    case "limited-access":
      next = setActions(next, "dashboard", [], { view: true });
      next = setActions(next, "projects", [], { view: true });
      next = setActions(next, "teamMembers", [], { view: true });
      next = setActions(next, "seating", [], { view: true });
      next = setActions(next, "gallery", [], { view: true });
      next = setActions(next, "roles", [], { view: false });
      next = setActions(next, "appUsers", [], { view: false });
      return next;
  }
}

export function ManageRoleDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const dialogKey = editing?.id ?? "new-role";
  const [name, setName] = React.useState(editing?.name ?? "");
  const [description, setDescription] = React.useState(editing?.description ?? "");
  const [color, setColor] = React.useState(editing?.color ?? COLOR_PRESETS[0]);
  const [permissions, setPermissions] = React.useState<ModulePermissionsMap>(
    initialDialogPermissions(editing),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [permissionFilter, setPermissionFilter] = React.useState("");

  const submit = async () => {
    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        color,
        permissions,
      };
      const res = await fetch(
        editing ? `/api/roles/${editing.id}` : "/api/roles",
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error(await parseApiError(res));
      onSaved((await res.json()) as WorkspaceRole);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={dialogKey}
        className="max-h-[92vh] overflow-hidden p-0 sm:max-w-5xl"
      >
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <DialogTitle>{editing ? "Edit role" : "Create role"}</DialogTitle>
            <DialogDescription>
              Build granular module access with view, CRUD, and action-level permissions.
              Existing roles remain compatible, while Manage still acts as the full-access
              shortcut.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-5">
              {error && (
                <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="role-name">Role name</Label>
                    <Input
                      id="role-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Coordinator, QA Lead"
                      disabled={editing?.isSystem}
                      className="h-11 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="role-desc">Description</Label>
                    <Textarea
                      id="role-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="What this role is responsible for…"
                      className="rounded-2xl"
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
                  <div className="space-y-2">
                    <Label>Badge color</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="h-9 w-9 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor:
                              color === c ? "hsl(var(--foreground))" : "transparent",
                          }}
                          onClick={() => setColor(c)}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                      <Input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-10 w-16 cursor-pointer rounded-2xl p-1"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      {name.trim().slice(0, 2).toUpperCase() || "RL"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{name.trim() || "New role"}</p>
                      <p className="text-sm text-muted-foreground">
                        {description.trim() || "Add a description to explain this role's purpose."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <section className="space-y-4 rounded-[24px] border border-border/70 bg-card/80 p-4 shadow-sm">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Permission presets
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Start from a ready-made access profile
                    </h3>
                  </div>
                  <div className="relative w-full xl:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={permissionFilter}
                      onChange={(e) => setPermissionFilter(e.target.value)}
                      placeholder="Search permissions or modules"
                      className="h-11 rounded-2xl pl-9"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPermissions(applyPreset(preset.id))}
                      className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-background/85 px-4 py-2 text-sm font-medium transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                      <Wand2 className="h-4 w-4" />
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {PRESETS.map((preset) => (
                    <div
                      key={`${preset.id}-copy`}
                      className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">{preset.label}</span>
                      <p className="mt-1 text-xs leading-5">{preset.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              <PermissionGrid
                value={permissions}
                onChange={setPermissions}
                disabled={false}
                filter={permissionFilter}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/70 bg-background/95 px-6 py-4 backdrop-blur sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Existing roles remain compatible. New granular selections are stored per module
              and mapped safely to legacy access checks where needed.
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-2xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={saving}
                className="rounded-2xl"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Create role"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
