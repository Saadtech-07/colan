"use client";

import * as React from "react";
import Link from "next/link";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/features/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteFloorPlanClient,
  invalidateFloorPlanClientCache,
} from "@/lib/floor-plans-client";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { useGlobalLoading } from "@/providers/global-loading";
import type { BranchSeatingRow } from "@/components/seating/seating-branch-list";

type Props = {
  row: BranchSeatingRow;
  onDeleted?: () => void | Promise<void>;
};

function editHrefForBranch(row: BranchSeatingRow): string {
  const primary =
    row.plans.find((plan) => plan.slug === row.primarySlug) ?? row.plans[0];
  const slug = row.primarySlug;
  if (primary?.migrationStatus === "builder") {
    return `/seating/floors/${encodeURIComponent(slug)}/builder`;
  }
  return `/seating/floors/${encodeURIComponent(slug)}/edit`;
}

export function BranchActionsMenu({ row, onDeleted }: Props) {
  const { withLoading, isLoadingKey } = useGlobalLoading();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const deleting = isLoadingKey("floor-plan-delete");

  const confirmDelete = async () => {
    setDeleteError(null);
    await withLoading("floor-plan-delete", LOADING_PRESETS.deletingFloorPlan, async () => {
      try {
        for (const plan of row.plans) {
          await deleteFloorPlanClient(plan.slug);
        }
        invalidateFloorPlanClientCache();
        setDeleteOpen(false);
        await onDeleted?.();
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : "Could not delete branch.");
        throw e;
      }
    });
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
            aria-label={`Branch actions for ${row.label}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44 rounded-2xl border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur"
        >
          <DropdownMenuItem asChild className="rounded-xl px-3 py-2 text-sm">
            <Link href={editHrefForBranch(row)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="rounded-xl px-3 py-2 text-sm text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        loading={deleting}
        title={`Delete ${row.label}?`}
        description={
          <>
            You are about to permanently delete{" "}
            <span className="font-medium text-foreground">{row.label}</span>
            {row.plans.length > 1
              ? ` and its ${row.plans.length} blocks`
              : ""}
            . All floor plan data for this branch will be removed. This action cannot be undone.
            {deleteError ? (
              <span className="mt-3 block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </span>
            ) : null}
          </>
        }
        confirmLabel="Delete branch"
        onConfirm={confirmDelete}
      />
    </>
  );
}
