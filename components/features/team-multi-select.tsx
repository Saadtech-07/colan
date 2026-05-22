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
        "max-h-48 space-y-1 overflow-y-auto rounded-lg border border-input bg-background/50 p-2",
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
              "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
              selected
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              (disabled || lockedTeam) && "cursor-default",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40",
              )}
            >
              {selected && <Check className="h-3 w-3" />}
            </span>
            <span className="truncate">{team}</span>
          </button>
        );
      })}
    </div>
  );
}
