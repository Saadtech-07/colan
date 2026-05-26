"use client";

import { RotateCcw, Search, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SeatingStats } from "@/lib/seating-utils";
import { teamTabLabel } from "@/lib/team-utils";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  teamFilter: string;
  onTeamFilterChange: (v: string) => void;
  viewMode: "all" | "occupied" | "available";
  onViewModeChange: (v: "all" | "occupied" | "available") => void;
  teamNames: string[];
  stats: SeatingStats;
  zoom: number;
  onZoomChange: (z: number) => void;
  onReset: () => void;
};

export function SeatingToolbar({
  search,
  onSearchChange,
  teamFilter,
  onTeamFilterChange,
  viewMode,
  onViewModeChange,
  teamNames,
  stats,
  zoom,
  onZoomChange,
  onReset,
}: Props) {
  return (
    <div className="sticky top-4 z-10 space-y-4 rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Controls
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight">Refine the layout view</h3>
        </div>

        <div className="relative min-w-0 flex-1 xl:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or employee ID…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background/85 pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={teamFilter} onValueChange={onTeamFilterChange}>
            <SelectTrigger className="h-11 w-[170px] rounded-2xl border-border/70 bg-background/85">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/60">
              <SelectItem value="All">All teams</SelectItem>
              {teamNames.map((t) => (
                <SelectItem key={t} value={t}>
                  {teamTabLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={viewMode} onValueChange={(v) => onViewModeChange(v as Props["viewMode"])}>
            <SelectTrigger className="h-11 w-[160px] rounded-2xl border-border/70 bg-background/85">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/60">
              <SelectItem value="all">All seats</SelectItem>
              <SelectItem value="occupied">Occupied only</SelectItem>
              <SelectItem value="available">Available only</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 rounded-2xl border-border/70 bg-background/80 px-4"
            onClick={onReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-border/70 bg-muted/60 px-3 py-1.5 tabular-nums">
            Total <strong className="text-foreground">{stats.total}</strong>
          </span>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 tabular-nums text-emerald-800 dark:text-emerald-300">
            Occupied <strong>{stats.occupied}</strong>
          </span>
          <span className="rounded-full border border-slate-500/15 bg-slate-500/10 px-3 py-1.5 tabular-nums">
            Available <strong>{stats.empty}</strong>
          </span>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full border border-border/70 bg-background/80 px-2 py-2 shadow-sm">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-border/70"
            onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center text-xs font-medium tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-border/70"
            onClick={() => onZoomChange(Math.min(1.25, zoom + 0.1))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
