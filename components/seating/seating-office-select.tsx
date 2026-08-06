"use client";

import * as React from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHENNAI_BLOCK_A_SLUG,
  CHENNAI_BLOCK_B_SLUG,
  isChennaiOfficeSlug,
  normalizeOfficeSlug,
} from "@/lib/floor-plan-layouts";
import type { FloorPlanSummary } from "@/models/floor-plan.model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type Props = {
  plans: FloorPlanSummary[];
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
};

type BranchGroup = {
  key: string;
  label: string;
  tabLabel: string;
  plans: FloorPlanSummary[];
};

function blockLabel(plan: FloorPlanSummary): string {
  if (plan.slug === CHENNAI_BLOCK_A_SLUG || plan.building === "Block A") return "Block A";
  if (plan.slug === CHENNAI_BLOCK_B_SLUG || plan.building === "Block B") return "Block B";
  return plan.building?.trim() || "Block A";
}

function groupPlansByBranch(plans: FloorPlanSummary[]): BranchGroup[] {
  const order: string[] = [];
  const map = new Map<string, FloorPlanSummary[]>();

  for (const plan of plans) {
    const city = (plan.city ?? plan.name).trim() || "Office";
    const key = isChennaiOfficeSlug(plan.slug) ? "Chennai" : city;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(plan);
  }

  return order.map((key) => {
    const groupPlans = (map.get(key) ?? [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const single = groupPlans[0];
    const tabLabel =
      key === "Chennai"
        ? "Chennai"
        : `${key} - ${blockLabel(single)}`;
    return {
      key,
      label: key,
      tabLabel,
      plans: groupPlans,
    };
  });
}

export function SeatingOfficeSelect({ plans, value, onChange, disabled }: Props) {
  const branches = React.useMemo(() => groupPlansByBranch(plans), [plans]);
  const currentSlug = normalizeOfficeSlug(value);
  const activeBranch = React.useMemo(() => {
    return (
      branches.find((b) => b.plans.some((p) => p.slug === currentSlug)) ??
      branches[0] ??
      null
    );
  }, [branches, currentSlug]);

  const activePlan =
    activeBranch?.plans.find((p) => p.slug === currentSlug) ??
    activeBranch?.plans[0] ??
    null;

  const chennaiBlocks =
    activeBranch?.key === "Chennai" ? activeBranch.plans : [];
  const showBlockDropdown = chennaiBlocks.length > 1;

  if (plans.length === 0) return null;

  const selectBranch = (branch: BranchGroup) => {
    if (disabled) return;
    const preferred =
      branch.key === "Chennai"
        ? branch.plans.find((p) => p.slug === CHENNAI_BLOCK_A_SLUG) ??
          branch.plans.find((p) => p.slug === currentSlug) ??
          branch.plans[0]
        : branch.plans[0];
    if (preferred) onChange(preferred.slug);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5 sm:w-auto">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">
          {activeBranch?.label ?? "Office"}
        </h2>

        {showBlockDropdown ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl border-border/70 bg-background px-3 text-sm font-semibold shadow-sm"
              >
                {activePlan ? blockLabel(activePlan) : "Block A"}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[10rem]">
              {chennaiBlocks.map((plan) => (
                <DropdownMenuItem
                  key={plan.slug}
                  className={cn(
                    "cursor-pointer rounded-lg text-sm font-medium",
                    plan.slug === currentSlug && "bg-accent",
                  )}
                  onClick={() => onChange(plan.slug)}
                >
                  {blockLabel(plan)}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {plan.seatCount} bays
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : activePlan ? (
          <span className="inline-flex h-9 items-center rounded-xl border border-border/70 bg-muted/40 px-3 text-sm font-semibold text-foreground">
            {blockLabel(activePlan)}
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground sm:text-sm">
        {activeBranch?.key === "Chennai"
          ? "Switch Block A or Block B from the dropdown. Occupancy updates when seats are assigned."
          : "Choose a branch to open its floor plan."}
      </p>

      <div
        className={cn(
          "inline-flex w-full flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-1",
          "sm:w-auto",
          disabled && "pointer-events-none opacity-60",
        )}
        role="tablist"
        aria-label="Office branch"
      >
        {branches.map((branch) => {
          const selected = activeBranch?.key === branch.key;
          return (
            <button
              key={branch.key}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => selectBranch(branch)}
              className={cn(
                "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors sm:flex-none sm:text-sm",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              {branch.tabLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
