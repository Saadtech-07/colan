"use client";

import * as React from "react";
import Link from "next/link";
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
import type { TeamDTO } from "@/models";

type Props = {
  team: TeamDTO;
  onDelete: (team: TeamDTO) => Promise<void>;
};

export function TeamActionsMenu({ team, onDelete }: Props) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

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
          <DropdownMenuItem asChild className="rounded-xl px-3 py-2 text-sm">
            <Link href={`/projects/teams/${team.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
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
