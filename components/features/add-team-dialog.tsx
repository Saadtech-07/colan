"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeTeamName } from "@/lib/team-utils";
import { useAppState } from "@/providers/app-state";

type Props = {
  onCreated?: () => void | Promise<void>;
};

export function AddTeamDialog({ onCreated }: Props) {
  const { addWorkspaceTeam } = useAppState();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const preview = name.trim() ? normalizeTeamName(name) : "";

  const submit = async () => {
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await addWorkspaceTeam(name.trim());
      setName("");
      setOpen(false);
      await onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setSaving(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Add team
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project team</DialogTitle>
          <DialogDescription>
            Create a squad for filtering projects and assigning work. Saved to the
            teams collection in MongoDB.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Java, Mobile, Data"
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
            {preview && (
              <p className="text-xs text-muted-foreground">
                Will be saved as: <span className="font-medium text-foreground">{preview}</span>
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving || !name.trim()}>
            {saving ? "Creating..." : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
