"use client";

import { ArrowLeftRight, ArrowRight, Building2, Loader2, MapPin } from "lucide-react";
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

export type SeatTransferPending =
  | {
      kind: "move";
      fromSeatId: string;
      toSeatId: string;
      employeeId: string;
      employeeName: string;
      officeSlug: string;
    }
  | {
      kind: "swap";
      fromSeatId: string;
      toSeatId: string;
      fromEmployeeId: string;
      fromEmployeeName: string;
      toEmployeeId: string;
      toEmployeeName: string;
      officeSlug: string;
    }
  | {
      kind: "cabin-swap";
      fromCabinId: string;
      toCabinId: string;
      fromCabinLabel: string;
      toCabinLabel: string;
      fromOccupantName?: string | null;
      toOccupantName?: string | null;
      officeSlug: string;
    };

type Props = {
  pending: SeatTransferPending | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  /** Raise above fullscreen seating overlay (z-[100]). */
  elevated?: boolean;
};

function SeatChip({ seatId }: { seatId: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
      <MapPin className="h-3 w-3 text-muted-foreground" aria-hidden />
      {seatId}
    </span>
  );
}

function CabinChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground">
      <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function SeatingTransferConfirmDialog({
  pending,
  onOpenChange,
  onConfirm,
  loading = false,
  elevated = false,
}: Props) {
  const open = pending !== null;
  const layerClass = elevated ? "z-[110]" : undefined;
  const isCabinSwap = pending?.kind === "cabin-swap";
  const isSwap = pending?.kind === "swap" || isCabinSwap;

  const title = isCabinSwap
    ? "Swap cabins?"
    : pending?.kind === "swap"
      ? "Swap seating places?"
      : "Move seating place?";

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent
        overlayClassName={layerClass}
        className={cn(
          "max-w-md gap-0 overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:rounded-[28px]",
          "[&>button.absolute]:hidden",
          layerClass,
        )}
        onPointerDownOutside={(event) => loading && event.preventDefault()}
        onEscapeKeyDown={(event) => loading && event.preventDefault()}
      >
        <div className="px-6 pb-2 pt-6">
          <DialogHeader className="space-y-4 text-center sm:text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {isSwap ? (
                <ArrowLeftRight className="h-7 w-7" aria-hidden />
              ) : (
                <ArrowRight className="h-7 w-7" aria-hidden />
              )}
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {title}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-4 text-sm leading-6 text-muted-foreground">
                  {pending?.kind === "cabin-swap" ? (
                    <>
                      <p>
                        Are you sure you want to swap cabin places for{" "}
                        <span className="font-semibold text-foreground">
                          {pending.fromCabinLabel}
                        </span>{" "}
                        and{" "}
                        <span className="font-semibold text-foreground">
                          {pending.toCabinLabel}
                        </span>
                        ? Each cabin keeps its people and resizes to fit the new slot.
                      </p>
                      <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-left">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-medium text-foreground">
                              {pending.fromOccupantName?.trim() || pending.fromCabinLabel}
                            </p>
                            <CabinChip label={pending.fromCabinLabel} />
                          </div>
                          <ArrowLeftRight
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <div className="min-w-0 space-y-1 text-right">
                            <p className="truncate font-medium text-foreground">
                              {pending.toOccupantName?.trim() || pending.toCabinLabel}
                            </p>
                            <CabinChip label={pending.toCabinLabel} />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : pending?.kind === "swap" ? (
                    <>
                      <p>
                        Are you sure you want to swap seating places for{" "}
                        <span className="font-semibold text-foreground">
                          {pending.fromEmployeeName}
                        </span>{" "}
                        and{" "}
                        <span className="font-semibold text-foreground">
                          {pending.toEmployeeName}
                        </span>
                        ?
                      </p>
                      <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-left">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-medium text-foreground">
                              {pending.fromEmployeeName}
                            </p>
                            <SeatChip seatId={pending.fromSeatId} />
                          </div>
                          <ArrowLeftRight
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <div className="min-w-0 space-y-1 text-right">
                            <p className="truncate font-medium text-foreground">
                              {pending.toEmployeeName}
                            </p>
                            <SeatChip seatId={pending.toSeatId} />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : pending?.kind === "move" ? (
                    <>
                      <p>
                        Are you sure you want to move{" "}
                        <span className="font-semibold text-foreground">
                          {pending.employeeName}
                        </span>
                        ’s seating place?
                      </p>
                      <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-left">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              From
                            </p>
                            <SeatChip seatId={pending.fromSeatId} />
                          </div>
                          <ArrowRight
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <div className="min-w-0 space-y-1 text-right">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              To
                            </p>
                            <SeatChip seatId={pending.toSeatId} />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
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
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11 min-w-[120px] rounded-2xl px-6 font-semibold shadow-sm"
            onClick={() => void onConfirm()}
            disabled={loading || !pending}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Updating…
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
