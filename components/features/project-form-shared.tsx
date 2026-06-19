"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { teamTabLabel } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import type { TeamName } from "@/types";

export const projectFormLabelClassName =
  "text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground";

export const projectFieldClassName =
  "h-11 rounded-lg border-border/55 bg-muted/20 text-[15px] font-normal shadow-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0";

export const projectTextareaClassName =
  "min-h-[96px] resize-none rounded-lg border-border/55 bg-muted/20 text-[15px] font-normal shadow-none placeholder:text-muted-foreground/55 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0";

export function ProjectFormField({
  id,
  label,
  required,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <Label htmlFor={id} className={cn(projectFormLabelClassName, "leading-snug")}>
        {label}
        {required ? (
          <span className="ml-0.5 normal-case tracking-normal text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}

export function TeamChipSelect({
  value,
  onChange,
  options,
  lockedTeam,
}: {
  value: TeamName[];
  onChange: (teams: TeamName[]) => void;
  options: TeamName[];
  lockedTeam?: TeamName;
}) {
  const effectiveValue = lockedTeam ? [lockedTeam] : value;

  const toggle = (team: TeamName) => {
    if (lockedTeam) return;
    onChange(
      effectiveValue.includes(team)
        ? effectiveValue.filter((entry) => entry !== team)
        : [...effectiveValue, team],
    );
  };

  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((team) => {
        const selected = effectiveValue.includes(team);
        return (
          <button
            key={team}
            type="button"
            disabled={!!lockedTeam}
            onClick={() => toggle(team)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
              selected
                ? "border-foreground/25 bg-foreground/5 text-foreground"
                : "border-border/60 bg-muted/15 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground",
              lockedTeam && "cursor-default opacity-90",
            )}
          >
            {selected ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} /> : null}
            {teamTabLabel(team)}
          </button>
        );
      })}
    </div>
  );
}
