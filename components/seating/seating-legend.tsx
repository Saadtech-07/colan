"use client";

import { teamLegendItems } from "@/lib/seating-utils";
import { cn } from "@/lib/utils";

type Props = {
  teamNames: string[];
};

export function SeatingLegend({ teamNames }: Props) {
  const items = teamLegendItems(teamNames);
  return (
    <section className="rounded-[24px] border border-border/70 bg-card/80 p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Legend
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight">Map indicators</h3>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <li className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/75 px-3 py-2.5 text-sm">
          <span className="h-7 w-11 rounded-xl border border-slate-200 bg-slate-50 shadow-sm" />
          <span className="font-medium">Empty seat</span>
        </li>
        <li className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/75 px-3 py-2.5 text-sm">
          <span className="h-7 w-11 rounded-xl border border-emerald-300/60 bg-emerald-50 shadow-sm" />
          <span className="font-medium">Occupied seat</span>
        </li>
        <li className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/75 px-3 py-2.5 text-sm">
          <span className="h-7 w-11 rounded-xl border border-slate-300 bg-slate-200 shadow-sm" />
          <span className="font-medium">Pillar</span>
        </li>
        <li className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/75 px-3 py-2.5 text-sm">
          <span className="inline-flex h-7 min-w-[48px] items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-2 text-[9px] font-bold uppercase tracking-[0.2em] text-sky-700 shadow-sm">
            IN
          </span>
          <span className="font-medium">Entrance</span>
        </li>
      </ul>

      {items.length > 0 && (
        <>
          <div className="mb-3 mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Teams
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Team color tags used on occupied seats.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2.5">
            {items.map(({ team, label, colors }) => (
              <li
                key={team}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm",
                  colors.bg,
                  colors.border,
                  colors.text,
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full shadow-sm", colors.dot)} />
                {label}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
