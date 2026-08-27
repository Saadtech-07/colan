"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppUserFormStep = "account" | "workspace";

type Props = {
  step: AppUserFormStep;
  mode: "create" | "edit";
};

export function AppUserFormStepper({ step }: Props) {
  const steps = [
    { id: "account" as const, label: "Account details" },
    { id: "workspace" as const, label: "Workspace details" },
  ];

  return (
    <nav
      aria-label="Account setup progress"
      className="flex flex-wrap items-center gap-2 text-xs"
    >
      {steps.map((item, index) => {
        const active = step === item.id;
        const done = step === "workspace" && item.id === "account";

        return (
          <div key={item.id} className="flex items-center gap-2">
            {index > 0 ? (
              <span
                className="hidden h-px w-4 bg-border sm:block"
                aria-hidden
              />
            ) : null}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : done
                    ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                    : "border-transparent bg-muted/30 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold leading-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-emerald-600 text-white"
                      : "bg-muted-foreground/15 text-muted-foreground",
                )}
                aria-hidden
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
              </span>
              <span className={cn("font-medium", active && "text-foreground")}>
                {item.label}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {index + 1}/2
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
