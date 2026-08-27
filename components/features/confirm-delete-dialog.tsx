"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConfirmDeleteTarget = {
  id: string;
  email: string;
  name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  title?: string;
  /** Account-style target (used when `description` is not provided). */
  target?: ConfirmDeleteTarget | null;
  entityLabel?: string;
  /** Custom body copy. Prefer this for non-account deletes. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  title = "Delete account?",
  target = null,
  entityLabel = "account",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: Props) {
  const canConfirm = Boolean(description) || Boolean(target);

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent
        className={cn(
          "max-w-md gap-0 overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:rounded-[28px]",
          "[&>button.absolute]:hidden",
        )}
        onPointerDownOutside={(event) => loading && event.preventDefault()}
        onEscapeKeyDown={(event) => loading && event.preventDefault()}
      >
        <div className="px-6 pb-2 pt-6">
          <DialogHeader className="space-y-4 text-center sm:text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-7 w-7" aria-hidden />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                {description ? (
                  description
                ) : target ? (
                  <>
                    You are about to permanently delete the{" "}
                    <span className="font-medium text-foreground">{entityLabel}</span> for{" "}
                    <span className="font-medium text-foreground">{target.name}</span> (
                    {target.email}). This action cannot be undone.
                  </>
                ) : (
                  "This action cannot be undone."
                )}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <DialogFooter className="flex-row justify-center gap-3 border-t border-border/60 bg-muted/20 px-6 py-5 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-[120px] rounded-2xl border-border/70 bg-background/90 px-6"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className="h-11 min-w-[120px] rounded-2xl border border-border/70 bg-background px-6 font-semibold text-foreground shadow-sm transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-destructive/30"
            onClick={() => void handleConfirm()}
            disabled={loading || !canConfirm}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Deleting…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
