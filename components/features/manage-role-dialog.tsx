"use client";

import * as React from "react";
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
import { EnterprisePermissionGrid } from "@/components/features/organization/enterprise-permission-grid";
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
  { id: "full-access", label: "Full access" },
  { id: "read-only", label: "Read only" },
  { id: "team-management", label: "Team lead" },
  { id: "workspace-control", label: "Admin" },
  { id: "limited-access", label: "Basic" },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: WorkspaceRole | null;
  onSaved: (role: WorkspaceRole) => void;
};

function initialDialogPermissions(editing: WorkspaceRole | null): ModulePermissionsMap {
  if (!editing?.permissions) {
    return emptyModulePermissions();
  }
  return normalizeModulePermissions(structuredClone(editing.permissions));
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
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState(COLOR_PRESETS[0]);
  const [permissions, setPermissions] = React.useState<ModulePermissionsMap>(
    emptyModulePermissions(),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setColor(editing?.color ?? COLOR_PRESETS[0]);
    setPermissions(initialDialogPermissions(editing));
    setError(null);
    setSaving(false);
    // Re-sync when the dialog opens or a different role is selected.
  }, [open, editing?.id, editing?.name, editing?.description, editing?.color, editing?.permissions]);

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
      setSaving(false);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  };

  const permissionsLocked = editing?.key === "admin" && editing.isSystem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(100vw-1.5rem,64rem)] overflow-hidden p-0 sm:max-w-5xl">
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <DialogTitle>{editing ? "Edit role" : "Create role"}</DialogTitle>
            <DialogDescription>
              Name the role and choose what each module can access.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-5">
              {error && (
                <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="role-name">Role name</Label>
                  <Input
                    id="role-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Coordinator, QA Lead"
                    disabled={editing?.isSystem}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="role-desc">Description</Label>
                  <Textarea
                    id="role-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Short summary of this role"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Badge color</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-105"
                        style={{
                          backgroundColor: c,
                          borderColor: color === c ? "hsl(var(--foreground))" : "transparent",
                        }}
                        onClick={() => setColor(c)}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                    <Input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded-lg p-1"
                    />
                  </div>
                </div>
              </div>

              <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                <Label>Quick presets</Label>
                {permissionsLocked ? (
                  <p className="text-sm text-muted-foreground">
                    The built-in Admin role always has full workspace access and cannot be
                    downgraded.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset) => (
                      <Button
                        key={preset.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPermissions(applyPreset(preset.id))}
                        className="h-8 rounded-lg bg-white px-3 text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                )}
              </section>

              <EnterprisePermissionGrid
                key={editing?.id ?? "new-role"}
                value={permissions}
                onChange={setPermissions}
                disabled={permissionsLocked}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/70 bg-background/95 px-6 py-4">
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={saving} className="rounded-xl">
                {saving ? "Saving…" : editing ? "Save changes" : "Create role"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
