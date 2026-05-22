"use client";

import { SEATING_ROWS } from "@/lib/seating-layout";
import { cn } from "@/lib/utils";

type Props = {
  occupancyRateByRow: Record<string, number>;
  selectedRow: string | null;
  onRowClick: (rowKey: string) => void;
};

export function SeatingMinimap({
  occupancyRateByRow,
  selectedRow,
  onRowClick,
}: Props) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Floor overview
      </p>
      <div className="space-y-1.5">
        {SEATING_ROWS.map((row) => {
          const rate = occupancyRateByRow[row.key] ?? 0;
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onRowClick(row.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/80",
                selectedRow === row.key && "bg-primary/10 ring-1 ring-primary/40",
              )}
            >
              <span className="w-10 font-mono font-semibold">{row.key}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round(rate * 100)}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums text-muted-foreground">
                {Math.round(rate * 100)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
