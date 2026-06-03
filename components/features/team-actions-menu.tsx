"use client";

import * as React from "react";
import { Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { normalizeTeamName } from "@/lib/team-utils";
import type { TeamDTO } from "@/models";
import type { TeamName } from "@/types";

type Props = {
  team: TeamDTO;
  onRename: (team: TeamDTO, nextName: string) => Promise<void>;
  onDelete: (team: TeamDTO) => Promise<void>;
};

export function TeamActionsMenu({ team, onRename, onDelete }: Props) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [name, setName] = React.useState(team.name);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const preview = name.trim() ? normalizeTeamName(name) : "";

  React.useEffect(() => {
    if (editOpen) {
      setName(team.name);
      setError(null);
    }
  }, [editOpen, team.name]);

  const submitRename = async () => {
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await onRename(team, name.trim());
      setEditOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update team");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await onDelete(team);
      setDeleteOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete team");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Team actions for ${team.name}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44 rounded-2xl border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur"
        >
          <DropdownMenuItem
            onClick={() => setEditOpen(true)}
            className="rounded-xl px-3 py-2 text-sm"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setError(null);
              setDeleteOpen(true);
            }}
            className="rounded-xl px-3 py-2 text-sm text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={(next) => !saving && setEditOpen(next)}>
        <DialogContent className="border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl sm:max-w-lg sm:rounded-[28px]">
          <DialogHeader className="space-y-2 border-b border-border/60 pb-4">
            <DialogTitle>Edit team</DialogTitle>
            <DialogDescription>
              Rename {team.name as TeamName}. Linked employees and projects will be updated
              automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor={`edit-team-${team.id}`}>Team name</Label>
              <Input
                id={`edit-team-${team.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Java, Mobile, Data"
                className="h-11 rounded-2xl border-border/70 bg-background/80"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitRename();
                }}
              />
              {preview && (
                <p className="text-xs text-muted-foreground">
                  Will be saved as:{" "}
                  <span className="font-medium text-foreground">{preview}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
              className="h-11 rounded-2xl border-border/70 bg-background/80"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitRename()}
              disabled={saving || !name.trim()}
              className="h-11 rounded-2xl px-5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => !deleting && setDeleteOpen(next)}>
        <DialogContent className="border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl sm:max-w-md sm:rounded-[28px]">
          <DialogHeader className="space-y-2 pb-2">
            <DialogTitle>Delete team?</DialogTitle>
            <DialogDescription>
              You are about to permanently remove{" "}
              <span className="font-medium text-foreground">{team.name}</span>. This team must
              have no employees, projects, or app users assigned before it can be deleted.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="h-11 rounded-2xl border-border/70 bg-background/80"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="h-11 rounded-2xl px-5"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete team"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
