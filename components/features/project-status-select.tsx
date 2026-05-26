"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_STATUSES } from "@/lib/project-ui";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

type Props = {
  value: ProjectStatus;
  canEdit: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (status: ProjectStatus) => void | Promise<void>;
};

function statusChipClasses(status: ProjectStatus) {
  if (status === "Completed") {
    return "border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "In Progress") {
    return "border-primary/20 bg-primary/10 text-primary";
  }
  return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

export function ProjectStatusSelect({
  value,
  canEdit,
  disabled,
  className,
  onChange,
}: Props) {
  const [saving, setSaving] = React.useState(false);

  if (!canEdit || !onChange) {
    return (
      <div
        className={cn(
          "inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold shadow-sm",
          statusChipClasses(value),
          className,
        )}
      >
        {value}
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === value || saving) return;
        setSaving(true);
        void Promise.resolve(onChange(next as ProjectStatus)).finally(() => setSaving(false));
      }}
      disabled={disabled || saving}
    >
      <SelectTrigger
        className={cn(
          "h-9 w-auto min-w-[142px] rounded-full border px-3 text-xs font-semibold shadow-sm transition-all duration-200 hover:shadow-md [&>svg]:opacity-70",
          statusChipClasses(value),
          className,
        )}
      >
        <span className="flex items-center gap-2 pr-1">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent className="rounded-2xl border-border/70 bg-background/95 backdrop-blur-xl">
        {PROJECT_STATUSES.map((status) => (
          <SelectItem key={status} value={status} className="rounded-xl">
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

