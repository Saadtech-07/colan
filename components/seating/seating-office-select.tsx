"use client";

import * as React from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  blockLabelForPlan,
  groupFloorPlansByBranch,
  type FloorPlanBranchGroup,
} from "@/lib/floor-plan-branch";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";
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

export function SeatingOfficeSelect({ plans, value, onChange, disabled }: Props) {
  const branches = React.useMemo(() => groupFloorPlansByBranch(plans), [plans]);
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

  const branchBlocks = activeBranch?.plans ?? [];
  const showBlockDropdown = branchBlocks.length > 1;

  if (plans.length === 0) return null;

  const selectBranch = (branch: FloorPlanBranchGroup) => {
    if (disabled) return;
    const preferred =
      branch.plans.find((p) => p.building === "Block A") ??
      branch.plans.find((p) => p.slug === currentSlug) ??
      branch.plans[0];
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
                {activePlan ? blockLabelForPlan(activePlan) : "Block A"}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[10rem]">
              {branchBlocks.map((plan) => (
                <DropdownMenuItem
                  key={plan.slug}
                  className={cn(
                    "cursor-pointer rounded-lg text-sm font-medium",
                    plan.slug === currentSlug && "bg-accent",
                  )}
                  onClick={() => onChange(plan.slug)}
                >
                  {blockLabelForPlan(plan)}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {plan.seatCount} bays
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground sm:text-sm">
        {showBlockDropdown
          ? "Switch Block A or Block B from the dropdown. Occupancy updates when seats are assigned."
          : "Choose a branch to open its floor plan."}
      </p>

      <div
        className={cn(
          "inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-1",
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
                "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors sm:text-sm",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              {branch.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
