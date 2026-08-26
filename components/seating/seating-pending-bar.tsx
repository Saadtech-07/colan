"use client";

import { History, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  pendingCount: number;
  saving?: boolean;
  canSave?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onOpenHistory: () => void;
};

export function SeatingPendingBar({
  pendingCount,
  saving = false,
  canSave = true,
  onSave,
  onCancel,
  onOpenHistory,
}: Props) {
  const hasPending = pendingCount > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        hasPending
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border/70 bg-background/80",
      )}
    >
      <p className="text-xs font-medium text-foreground sm:text-sm">
        {hasPending
          ? `${pendingCount} pending seating ${pendingCount === 1 ? "change" : "changes"} — save to apply and create a version.`
          : "Seat moves stay pending until you save a new version."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-xl px-3 text-xs font-semibold"
          onClick={onOpenHistory}
        >
          <History className="h-3.5 w-3.5" />
          Version history
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-xl px-3 text-xs font-semibold"
          onClick={onCancel}
          disabled={!hasPending || saving}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Cancel Changes
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5 rounded-xl px-3 text-xs font-semibold"
          onClick={onSave}
          disabled={!hasPending || !canSave || saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
