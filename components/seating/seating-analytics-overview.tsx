"use client";

import type { LucideIcon } from "lucide-react";
import { Armchair, LayoutGrid, Percent, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SeatingStats } from "@/lib/seating-utils";
import { cn } from "@/lib/utils";

type Props = {
  stats: SeatingStats;
};

type AnalyticsItem = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  accentClassName: string;
  iconClassName: string;
};

export function SeatingAnalyticsOverview({ stats }: Props) {
  const occupancyRate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;

  const items: AnalyticsItem[] = [
    {
      label: "Total bays",
      value: `${stats.total}`,
      helper: "Across the full seating plan",
      icon: LayoutGrid,
      accentClassName: "border-slate-200/80 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-950/40",
      iconClassName: "bg-slate-900/10 text-slate-700 dark:bg-slate-100/10 dark:text-slate-200",
    },
    {
      label: "Occupied",
      value: `${stats.occupied}`,
      helper: "Currently assigned seats",
      icon: Users,
      accentClassName: "border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-900/60 dark:bg-emerald-950/30",
      iconClassName: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    },
    {
      label: "Available",
      value: `${stats.empty}`,
      helper: "Ready for seat assignment",
      icon: Armchair,
      accentClassName: "border-amber-200/80 bg-amber-50/90 dark:border-amber-900/60 dark:bg-amber-950/30",
      iconClassName: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    },
    {
      label: "Utilization",
      value: `${occupancyRate}%`,
      helper: "Occupied vs total capacity",
      icon: Percent,
      accentClassName: "border-violet-200/80 bg-violet-50/90 dark:border-violet-900/60 dark:bg-violet-950/30",
      iconClassName: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Admin overview
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Bay analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live seating capacity and utilization.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center self-start rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
          Live
        </span>
      </div>

      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.label}
              className={cn(
                "h-full rounded-2xl border shadow-sm hover:shadow-sm",
                item.accentClassName,
              )}
            >
              <CardContent className="flex h-full flex-col p-4">
                <span
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-xl",
                    item.iconClassName,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="mt-3 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold leading-none tabular-nums text-foreground">
                    {item.value}
                  </p>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {item.helper}
                </p>
                <div className="mt-auto pt-3">
                  <span
                    className={cn(
                      "block h-px w-full rounded-full opacity-60",
                      item.label === "Total bays" && "bg-slate-200 dark:bg-slate-800",
                      item.label === "Occupied" && "bg-emerald-200 dark:bg-emerald-900/70",
                      item.label === "Available" && "bg-amber-200 dark:bg-amber-900/70",
                      item.label === "Utilization" && "bg-violet-200 dark:bg-violet-900/70",
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
