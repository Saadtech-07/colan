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
    <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or employee ID…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={teamFilter} onValueChange={onTeamFilterChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All teams</SelectItem>
              {teamNames.map((t) => (
                <SelectItem key={t} value={t}>
                  {teamTabLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={viewMode} onValueChange={(v) => onViewModeChange(v as Props["viewMode"])}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All seats</SelectItem>
              <SelectItem value="occupied">Occupied only</SelectItem>
              <SelectItem value="available">Available only</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-md bg-muted px-2.5 py-1 tabular-nums">
            Total <strong className="text-foreground">{stats.total}</strong>
          </span>
          <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 tabular-nums text-emerald-800 dark:text-emerald-300">
            Occupied <strong>{stats.occupied}</strong>
          </span>
          <span className="rounded-md bg-slate-500/15 px-2.5 py-1 tabular-nums">
            Available <strong>{stats.empty}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
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
