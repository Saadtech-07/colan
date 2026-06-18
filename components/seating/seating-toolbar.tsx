"use client";

import { ChevronDown, Filter, RotateCcw, Search, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const VIEW_LABELS: Record<Props["viewMode"], string> = {
  all: "All seats",
  occupied: "Occupied only",
  available: "Available only",
};

const GENDER_LABELS: Record<string, string> = {
  all: "All genders",
  male: "Male",
  female: "Female",
  other: "Other",
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
  const activeFilterCount = [
    teamFilter !== "All",
    roleFilter !== "all",
    genderFilter !== "all",
    viewMode !== "all",
  ].filter(Boolean).length;

  const teamLabel = teamFilter === "All" ? "All teams" : teamTabLabel(teamFilter);
  const roleLabel =
    roleFilterOptions.find((option) => option.value === roleFilter)?.label ?? "All roles";
  const genderLabel = GENDER_LABELS[genderFilter] ?? "All genders";

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-border/70 bg-background px-4"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                    {activeFilterCount}
                  </span>
                ) : null}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-2xl border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur"
            >
              <DropdownMenuLabel className="px-2 text-xs text-muted-foreground">
                Refine floor plan
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/60" />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-xl">
                  Team · {teamLabel}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-2xl border-border/60 p-1.5">
                  <DropdownMenuRadioGroup value={teamFilter} onValueChange={onTeamFilterChange}>
                    <DropdownMenuRadioItem value="All" className="rounded-xl">
                      All teams
                    </DropdownMenuRadioItem>
                    {teamNames.map((team) => (
                      <DropdownMenuRadioItem key={team} value={team} className="rounded-xl">
                        {teamTabLabel(team)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-xl">
                  Role · {roleLabel === "All" ? "All roles" : roleLabel}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-2xl border-border/60 p-1.5">
                  <DropdownMenuRadioGroup value={roleFilter} onValueChange={onRoleFilterChange}>
                    {roleFilterOptions.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.value}
                        value={option.value}
                        className="rounded-xl"
                      >
                        {option.label === "All" ? "All roles" : option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-xl">
                  Gender · {genderLabel}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-2xl border-border/60 p-1.5">
                  <DropdownMenuRadioGroup value={genderFilter} onValueChange={onGenderFilterChange}>
                    <DropdownMenuRadioItem value="all" className="rounded-xl">
                      All genders
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="male" className="rounded-xl">
                      Male
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="female" className="rounded-xl">
                      Female
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="other" className="rounded-xl">
                      Other
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-xl">
                  Seats · {VIEW_LABELS[viewMode]}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-2xl border-border/60 p-1.5">
                  <DropdownMenuRadioGroup
                    value={viewMode}
                    onValueChange={(value) => onViewModeChange(value as Props["viewMode"])}
                  >
                    <DropdownMenuRadioItem value="all" className="rounded-xl">
                      All seats
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="occupied" className="rounded-xl">
                      Occupied only
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="available" className="rounded-xl">
                      Available only
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem className="rounded-xl" onClick={onReset}>
                <RotateCcw className="h-4 w-4" />
                Reset filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
