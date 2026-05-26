"use client";

import { SEATING_ROWS } from "@/lib/seating-layout";
import { cn } from "@/lib/utils";

type Props = {
  occupancyRateByRow: Record<string, number>;
  occupiedSeatsByRow: Record<string, number>;
  selectedRow: string | null;
  onRowClick: (rowKey: string) => void;
};

export function SeatingMinimap({
  occupancyRateByRow,
  occupiedSeatsByRow,
  selectedRow,
  onRowClick,
}: Props) {
  return (
    <section className="rounded-[24px] border border-border/70 bg-card/80 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Floor overview
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight">Row occupancy</h3>
        </div>
        <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          Click a row to jump
        </span>
      </div>

      <div className="space-y-2.5">
        {SEATING_ROWS.map((row) => {
          const rate = occupancyRateByRow[row.key] ?? 0;
          const occupied = occupiedSeatsByRow[row.key] ?? 0;
          const percentage = Math.round(rate * 100);
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onRowClick(row.key)}
              className={cn(
                "w-full rounded-2xl border border-transparent bg-background/70 p-3 text-left transition-all hover:border-border/70 hover:bg-muted/60",
                selectedRow === row.key &&
                  "border-primary/30 bg-primary/5 shadow-sm ring-1 ring-primary/20",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-sm font-semibold">{row.key}</span>
                    <span className="text-sm font-medium text-foreground">
                      {row.seatCount} seats
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {occupied} occupied, {percentage}% utilized
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {percentage}%
                </span>
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
