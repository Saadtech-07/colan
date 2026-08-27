"use client";

import * as React from "react";
import { ArrowRight, Clock3, History, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchSeatHistory } from "@/lib/seating-seat-history-client";
import { cn } from "@/lib/utils";
import type { SeatHistoryAction, SeatHistoryEntry } from "@/models/seating-seat-history.model";

type Props = {
  open: boolean;
  officeSlug: string;
  seatId: string | null;
  onOpenChange: (open: boolean) => void;
  elevated?: boolean;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function actionVariant(action: SeatHistoryAction): "default" | "secondary" | "success" | "warning" | "muted" {
  switch (action) {
    case "assigned":
    case "moved-in":
    case "swapped-in":
      return "success";
    case "removed":
      return "warning";
    case "moved-out":
    case "swapped-out":
      return "muted";
    default:
      return "secondary";
  }
}

export function SeatingSeatHistorySheet({
  open,
  officeSlug,
  seatId,
  onOpenChange,
  elevated = false,
}: Props) {
  const [entries, setEntries] = React.useState<SeatHistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !seatId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSeatHistory(officeSlug, seatId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load history.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [officeSlug, open, seatId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        overlayClassName={elevated ? "z-[110]" : undefined}
        className={cn(elevated && "z-[120]")}
      >
        <SheetHeader className="border-b border-border/60 px-6 py-5 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Seat {seatId} history
          </SheetTitle>
          <SheetDescription>
            Read-only record of who occupied this bay, when they sat here, and where they
            moved. Latest changes first.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-4">
          {loading ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">
              Loading history…
            </p>
          ) : error ? (
            <p className="px-2 py-8 text-center text-sm text-destructive">{error}</p>
          ) : entries.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">
              No assignment history for this seat yet. History is recorded when seating
              changes are saved.
            </p>
          ) : (
            <ol className="relative space-y-3 border-l border-border/70 pl-4">
              {entries.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[1.3rem] top-2 h-2.5 w-2.5 rounded-full border border-background bg-primary" />
                  <div className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={actionVariant(entry.action)}>{entry.actionLabel}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {entry.employeeName}
                      {entry.employeeCode ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          {entry.employeeCode}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{entry.previousSeat || "Unassigned"}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span>{entry.newSeat || "Unassigned"}</span>
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3 shrink-0" />
                      {formatWhen(entry.createdAt)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <UserRound className="h-3 w-3 shrink-0" />
                      {entry.createdBy.name}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
