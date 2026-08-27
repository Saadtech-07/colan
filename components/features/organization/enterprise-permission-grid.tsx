"use client";

import * as React from "react";
import {
  ACCESS_LEVEL_OPTIONS,
  modulePermissionToAccessLevel,
  setModuleAccessLevel,
} from "@/lib/rbac-access-levels";
import {
  MODULE_PERMISSION_CATALOG,
  RBAC_MODULES,
  normalizeModulePermissions,
  type ModulePermissionsMap,
  type RbacModule,
} from "@/lib/rbac-modules";
import type { PermissionAccessLevel } from "@/types";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value: ModulePermissionsMap;
  onChange: (next: ModulePermissionsMap) => void;
  disabled?: boolean;
  filter?: string;
};

export function EnterprisePermissionGrid({ value, onChange, disabled, filter = "" }: Props) {
  const normalized = React.useMemo(() => normalizeModulePermissions(value), [value]);
  const needle = filter.trim().toLowerCase();

  const modules = RBAC_MODULES.filter((module) => {
    if (!needle) return true;
    const entry = MODULE_PERMISSION_CATALOG[module];
    return (
      entry.title.toLowerCase().includes(needle) ||
      entry.description.toLowerCase().includes(needle)
    );
  });

  const setLevel = (module: RbacModule, level: PermissionAccessLevel) => {
    onChange(setModuleAccessLevel(normalized, module, level));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <div className="grid grid-cols-[minmax(0,1.4fr)_160px] gap-3 border-b border-border/70 bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Module</span>
        <span>Access level</span>
      </div>
      <div className="divide-y divide-border/60">
        {modules.map((module) => {
          const entry = MODULE_PERMISSION_CATALOG[module];
          const level = modulePermissionToAccessLevel(module, normalized[module]);
          return (
            <div
              key={module}
              className="grid grid-cols-[minmax(0,1.4fr)_160px] items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{entry.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
              </div>
              <Select
                value={level}
                onValueChange={(next) => setLevel(module, next as PermissionAccessLevel)}
                disabled={disabled}
              >
                <SelectTrigger className={cn("h-9", level === "full" && "border-emerald-300")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
