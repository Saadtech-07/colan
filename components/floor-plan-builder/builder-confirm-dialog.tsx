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

export type BuilderConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type Props = {
  open: boolean;
  options: BuilderConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function BuilderConfirmDialog({ open, options, onConfirm, onCancel }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent
        overlayClassName="z-[300]"
        className="z-[300] rounded-2xl sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{options?.title ?? "Confirm"}</DialogTitle>
          <DialogDescription>{options?.description ?? ""}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel}>
            {options?.cancelLabel ?? "Cancel"}
          </Button>
          <Button type="button" className="rounded-xl" onClick={onConfirm}>
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useBuilderConfirmDialog() {
  const [state, setState] = React.useState<{
    options: BuilderConfirmOptions;
    resolve: (confirmed: boolean) => void;
  } | null>(null);
  const resolveRef = React.useRef<((confirmed: boolean) => void) | null>(null);

  const requestConfirm = React.useCallback((options: BuilderConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ options, resolve });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(null);
  }, []);

  const handleCancel = React.useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(null);
  }, []);

  const dialog = (
    <BuilderConfirmDialog
      open={state !== null}
      options={state?.options ?? null}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { requestConfirm, dialog };
}
