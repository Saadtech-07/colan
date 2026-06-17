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

type RoleFilterOption = {
  value: string;
  label: string;
};

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  teamFilter: string;
  onTeamFilterChange: (v: string) => void;
  roleFilter: string;
  onRoleFilterChange: (v: string) => void;
  roleFilterOptions: RoleFilterOption[];
  genderFilter: string;
  onGenderFilterChange: (v: string) => void;
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
  roleFilter,
  onRoleFilterChange,
  roleFilterOptions,
  genderFilter,
  onGenderFilterChange,
  viewMode,
  onViewModeChange,
  teamNames,
  stats,
  zoom,
  onZoomChange,
  onReset,
}: Props) {
  return (
    <div className="shrink-0 space-y-3 rounded-2xl border border-border/70 bg-background/90 p-3.5 shadow-sm backdrop-blur sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or employee ID…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 rounded-xl border-border/70 bg-background pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={teamFilter} onValueChange={onTeamFilterChange}>
            <SelectTrigger className="h-10 w-[150px] rounded-xl border-border/70 bg-background">
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
          <Select value={roleFilter} onValueChange={onRoleFilterChange}>
            <SelectTrigger className="h-10 w-[150px] rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/60">
              {roleFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label === "All" ? "All roles" : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={genderFilter} onValueChange={onGenderFilterChange}>
            <SelectTrigger className="h-10 w-[130px] rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/60">
              <SelectItem value="all">All genders</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={viewMode} onValueChange={(v) => onViewModeChange(v as Props["viewMode"])}>
            <SelectTrigger className="h-10 w-[150px] rounded-xl border-border/70 bg-background">
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
            className="h-10 rounded-xl border-border/70 bg-background px-4"
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
            onClick={() => onZoomChange(Math.max(0.65, zoom - 0.05))}
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
            onClick={() => onZoomChange(Math.min(1.1, zoom + 0.05))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
