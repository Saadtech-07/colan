"use client";

import * as React from "react";
import {
  MODULE_PERMISSION_CATALOG,
  RBAC_MODULES,
  getModuleActionConfigs,
  moduleHasAnyAccess,
  normalizeModulePermissions,
  type ModulePermissionsMap,
  type RbacModule,
} from "@/lib/rbac-modules";
import { cn } from "@/lib/utils";

type Props = {
  value: ModulePermissionsMap;
  onChange: (next: ModulePermissionsMap) => void;
  disabled?: boolean;
  filter?: string;
};

type PermissionToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  tone?: "default" | "manage";
};

function PermissionToggle({
  checked,
  onChange,
  label,
  disabled,
  tone = "default",
}: PermissionToggleProps) {
  const inputId = React.useId();

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex min-h-[42px] items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        checked &&
          tone === "default" &&
          "border-sky-200 bg-sky-50 text-sky-800",
        checked &&
          tone === "manage" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        !checked && "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/80",
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className={cn(
          "h-4 w-4 shrink-0 rounded border-input accent-sky-600",
          tone === "manage" && "accent-emerald-600",
        )}
      />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

export function PermissionGrid({
  value,
  onChange,
  disabled,
  filter = "",
}: Props) {
  const normalized = React.useMemo(() => normalizeModulePermissions(value), [value]);

  const setModule = React.useCallback(
    (module: RbacModule, updater: (current: ModulePermissionsMap[RbacModule]) => ModulePermissionsMap[RbacModule]) => {
      onChange({
        ...normalized,
        [module]: updater(normalized[module]),
      });
    },
    [normalized, onChange],
  );

  const setView = (module: RbacModule, enabled: boolean) => {
    setModule(module, (current) => {
      if (!enabled) {
        return {
          view: false,
          manage: false,
          actions: Object.fromEntries(
            Object.keys(current.actions).map((key) => [key, false]),
          ),
        };
      }
      return {
        ...current,
        view: true,
      };
    });
  };

  const setManage = (module: RbacModule, enabled: boolean) => {
    setModule(module, (current) => {
      const nextActions = { ...current.actions };
      if (enabled) {
        for (const action of getModuleActionConfigs(module)) {
          nextActions[action.key] = true;
        }
      }

      const hasActions = Object.values(nextActions).some(Boolean);
      return {
        view: enabled ? true : current.view || hasActions,
        manage: enabled,
        actions: nextActions,
      };
    });
  };

  const setAction = (module: RbacModule, actionKey: string, enabled: boolean) => {
    setModule(module, (current) => {
      const nextActions = {
        ...current.actions,
        [actionKey]: enabled,
      };
      const hasActions = Object.values(nextActions).some(Boolean);
      return {
        view: current.manage ? true : current.view || enabled || hasActions,
        manage: current.manage,
        actions: nextActions,
      };
    });
  };

  const visibleModules = RBAC_MODULES.filter((rbacModule) => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return true;
    }
    const entry = MODULE_PERMISSION_CATALOG[rbacModule];
    return (
      entry.title.toLowerCase().includes(query) ||
      entry.actions.some((action) => action.label.toLowerCase().includes(query))
    );
  });

  if (visibleModules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-muted-foreground">
        No modules match your search.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Module access</p>

      <div className="grid gap-3 lg:grid-cols-2">
        {visibleModules.map((rbacModule) => {
          const entry = MODULE_PERMISSION_CATALOG[rbacModule];
          const row = normalized[rbacModule];

          return (
            <section
              key={rbacModule}
              className={cn(
                "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm",
                moduleHasAnyAccess(row) && "border-sky-200/80 bg-sky-50/30",
              )}
            >
              <p className="mb-3 text-sm font-semibold text-foreground">{entry.title}</p>

              <div className="grid gap-2 sm:grid-cols-2">
                <PermissionToggle
                  label="View"
                  checked={row.view}
                  disabled={disabled}
                  onChange={(checked) => setView(rbacModule, checked)}
                />
                <PermissionToggle
                  label="Manage"
                  checked={row.manage}
                  disabled={disabled}
                  tone="manage"
                  onChange={(checked) => setManage(rbacModule, checked)}
                />
              </div>

              {entry.actions.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {entry.actions.map((action) => (
                    <PermissionToggle
                      key={`${rbacModule}-${action.key}`}
                      label={action.label}
                      checked={!!row.actions[action.key] || row.manage}
                      disabled={disabled || row.manage}
                      onChange={(checked) => setAction(rbacModule, action.key, checked)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
