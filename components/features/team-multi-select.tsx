"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamName } from "@/types";

type Props = {
  value: TeamName[];
  onChange: (teams: TeamName[]) => void;
  options: TeamName[];
  lockedTeam?: TeamName;
  disabled?: boolean;
};

export function TeamMultiSelect({
  value,
  onChange,
  options,
  lockedTeam,
  disabled,
}: Props) {
  const effectiveValue = lockedTeam ? [lockedTeam] : value;

  const toggle = (team: TeamName) => {
    if (lockedTeam || disabled) return;
    onChange(
      effectiveValue.includes(team)
        ? effectiveValue.filter((t) => t !== team)
        : [...effectiveValue, team],
    );
  };

  return (
    <div
      className={cn(
        "max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-muted/10 p-2 pr-1.5",
        (disabled || lockedTeam) && "opacity-90",
      )}
    >
      {options.map((team) => {
        const selected = effectiveValue.includes(team);
        return (
          <button
            key={team}
            type="button"
            disabled={disabled || !!lockedTeam}
            onClick={() => toggle(team)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary/30 bg-primary/[0.07] text-foreground shadow-sm"
                : "border-transparent bg-background/60 text-muted-foreground hover:border-border/70 hover:bg-background hover:text-foreground hover:shadow-sm",
              (disabled || lockedTeam) && "cursor-default",
            )}
          >
            <span
              className={cn(
                "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/35 bg-background",
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="truncate font-medium">{team}</span>
          </button>
        );
      })}
    </div>
  );
}
