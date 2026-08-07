"use client";

import type { LucideIcon } from "lucide-react";
import { Armchair, LayoutGrid, Percent, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SeatingStats } from "@/lib/seating-utils";
import { cn } from "@/lib/utils";

type Props = {
  stats: SeatingStats;
  /** Match dashboard summary card sizing and styling. */
  variant?: "dashboard" | "legacy";
  /** @deprecated Use variant="legacy" instead. */
  compact?: boolean;
  /** Hide the Utilization card (branch list overview). */
  hideUtilization?: boolean;
};

type AnalyticsItem = {
  label: string;
  value: string;
  icon: LucideIcon;
  toneClass: string;
  iconClassName: string;
};

export function SeatingAnalyticsOverview({
  stats,
  variant = "dashboard",
  compact = false,
  hideUtilization = false,
}: Props) {
  const occupancyRate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
  const useDashboardStyle = variant === "dashboard" || compact;

  const items: AnalyticsItem[] = [
    {
      label: "Total bays",
      value: `${stats.total}`,
      icon: LayoutGrid,
      toneClass:
        "from-slate-500/12 via-slate-500/6 to-transparent text-slate-600 dark:text-slate-300",
      iconClassName: "text-slate-600 dark:text-slate-300",
    },
    {
      label: "Occupied",
      value: `${stats.occupied}`,
      icon: Users,
      toneClass:
        "from-emerald-500/12 via-emerald-500/6 to-transparent text-emerald-600 dark:text-emerald-300",
      iconClassName: "text-emerald-600 dark:text-emerald-300",
    },
    {
      label: "Available",
      value: `${stats.empty}`,
      icon: Armchair,
      toneClass:
        "from-amber-500/12 via-amber-500/6 to-transparent text-amber-700 dark:text-amber-300",
      iconClassName: "text-amber-700 dark:text-amber-300",
    },
  ];

  if (!hideUtilization) {
    items.push({
      label: "Utilization",
      value: `${occupancyRate}%`,
      icon: Percent,
      toneClass:
        "from-violet-500/12 via-violet-500/6 to-transparent text-violet-600 dark:text-violet-300",
      iconClassName: "text-violet-600 dark:text-violet-300",
    });
  }

  if (!useDashboardStyle) {
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
              Live seating capacity and bay occupancy.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "grid auto-rows-fr gap-3 sm:grid-cols-2",
            hideUtilization ? "lg:grid-cols-3" : "lg:grid-cols-4",
          )}
        >          {items.map((item) => (
            <LegacyStatCard key={item.label} item={item} compact={false} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        hideUtilization ? "xl:grid-cols-3" : "xl:grid-cols-4",
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.label}
            className="group relative overflow-hidden border-border/70 bg-background/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]"
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br", item.toneClass)} />
            <CardContent className="relative flex h-full flex-col justify-between p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                    {item.value}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5 shadow-sm transition-transform duration-300 group-hover:scale-105">
                  <Icon className={cn("h-5 w-5", item.iconClassName)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LegacyStatCard({
  item,
  compact,
}: {
  item: AnalyticsItem;
  compact: boolean;
}) {
  const Icon = item.icon;
  return (
    <Card className={cn("h-full border shadow-sm hover:shadow-sm", compact ? "rounded-xl" : "rounded-2xl")}>
      <CardContent className={cn("flex h-full items-center", compact ? "gap-2.5 p-2.5" : "flex-col p-4")}>
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-lg bg-muted/40",
            compact ? "h-7 w-7" : "h-10 w-10 rounded-xl",
          )}
        >
          <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", item.iconClassName)} />
        </span>
        <div className={cn("min-w-0", compact ? "flex-1" : "mt-3 w-full")}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-2 text-3xl font-bold leading-none tabular-nums text-foreground">
            {item.value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
