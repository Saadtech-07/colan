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
import { PermissionGrid } from "@/components/features/permission-grid";
import {
  emptyModulePermissions,
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: WorkspaceRole | null;
  onSaved: (role: WorkspaceRole) => void;
};

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
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description);
      setColor(editing.color);
      setPermissions(normalizeModulePermissions(editing.permissions));
    } else {
      setName("");
      setDescription("");
      setColor(COLOR_PRESETS[0]);
      setPermissions(emptyModulePermissions());
    }
    setError(null);
    setSaving(false);
  }, [open, editing]);

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit role" : "Create role"}</DialogTitle>
          <DialogDescription>
            Enable View for read-only access. Enable Manage for full control of that
            module (includes View automatically).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What this role is responsible for…"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Badge color</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
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
                  className="h-9 w-14 cursor-pointer p-1"
                />
              </div>
            </div>
          </div>
          <PermissionGrid
            value={permissions}
            onChange={setPermissions}
            disabled={false}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
