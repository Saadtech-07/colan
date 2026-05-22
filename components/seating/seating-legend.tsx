"use client";

import { teamLegendItems } from "@/lib/seating-utils";
import { cn } from "@/lib/utils";

type Props = {
  teamNames: string[];
};

export function SeatingLegend({ teamNames }: Props) {
  const items = teamLegendItems(teamNames);
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Legend
      </p>
      <ul className="space-y-2 text-xs">
        <li className="flex items-center gap-2">
          <span className="h-6 w-10 rounded-sm border-2 border-black/70 bg-slate-100" />
          <span>Empty seat</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-6 w-10 rounded-sm border-2 border-sky-500/60 bg-sky-500/25" />
          <span>Occupied seat</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-6 w-10 rounded-sm ring-2 ring-primary ring-offset-1" />
          <span>Selected</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-6 w-10 rounded-sm bg-zinc-500" />
          <span>Pillar</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-6 min-w-[48px] rounded-sm bg-sky-400/90 px-1 text-[8px] text-white">
            IN
          </span>
          <span>Entrance</span>
        </li>
      </ul>
      {items.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Teams
          </p>
          <ul className="flex flex-wrap gap-2">
            {items.map(({ team, label, colors }) => (
              <li
                key={team}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
                  colors.bg,
                  colors.border,
                  colors.text,
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", colors.dot)} />
                {label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
