"use client";

import * as React from "react";
import {
  MODULE_PERMISSION_CATALOG,
  RBAC_MODULES,
  getEnabledModuleActionLabels,
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

type PermissionCheckboxCardProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: "default" | "manage";
  helper?: string;
};

function PermissionCheckboxCard({
  checked,
  onChange,
  label,
  description,
  disabled,
  tone = "default",
  helper,
}: PermissionCheckboxCardProps) {
  const inputId = React.useId();

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex min-h-[76px] items-start gap-3 rounded-2xl border px-3.5 py-3 transition-all",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked &&
          tone === "default" &&
          "border-primary/30 bg-primary/10 shadow-sm",
        checked &&
          tone === "manage" &&
          "border-emerald-500/30 bg-emerald-500/10 shadow-sm",
        !checked &&
          "border-border/70 bg-background/80 hover:border-border hover:bg-background",
        disabled && "opacity-60",
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 rounded border-input bg-background accent-primary",
          tone === "manage" && "accent-emerald-600",
        )}
      />
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-medium",
            checked && tone === "default" && "text-primary",
            checked &&
              tone === "manage" &&
              "text-emerald-700 dark:text-emerald-300",
            !checked && "text-foreground",
          )}
        >
          {label}
        </span>
        {description && (
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        )}
        {helper && (
          <span className="mt-2 inline-flex rounded-full border border-border/60 bg-background/85 px-2 py-0.5 text-[11px] text-muted-foreground">
            {helper}
          </span>
        )}
      </span>
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
      entry.description.toLowerCase().includes(query) ||
      entry.actions.some(
        (action) =>
          action.label.toLowerCase().includes(query) ||
          action.description.toLowerCase().includes(query),
      )
    );
  });

  if (visibleModules.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        No permission modules match your search.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        View is required for every advanced action. Manage grants full access for that module,
        and turning Manage off keeps the currently selected permissions.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleModules.map((rbacModule) => {
          const entry = MODULE_PERMISSION_CATALOG[rbacModule];
          const row = normalized[rbacModule];
          const enabledLabels = getEnabledModuleActionLabels(rbacModule, row);
          const hasSelectedActions = Object.values(row.actions).some(Boolean);

          return (
            <section
              key={rbacModule}
              className={cn(
                "rounded-[24px] border border-border/70 bg-card/80 p-4 shadow-sm transition-all",
                moduleHasAnyAccess(row) && "border-primary/20 bg-primary/5",
              )}
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-semibold tracking-tight">{entry.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                  {enabledLabels.length === 0
                    ? "No access"
                    : `${enabledLabels.length} permission${enabledLabels.length === 1 ? "" : "s"} enabled`}
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <PermissionCheckboxCard
                    label="View"
                    description={entry.view}
                    checked={row.view}
                    disabled={disabled}
                    helper={
                      row.manage
                        ? "Required by Manage"
                        : hasSelectedActions
                          ? "Required for selected actions"
                          : undefined
                    }
                    onChange={(checked) => setView(rbacModule, checked)}
                  />
                  <PermissionCheckboxCard
                    label="Manage"
                    description={entry.manage}
                    checked={row.manage}
                    disabled={disabled}
                    tone="manage"
                    helper={row.manage ? "Full module access enabled" : undefined}
                    onChange={(checked) => setManage(rbacModule, checked)}
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Actions
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {entry.actions.map((action) => (
                      <PermissionCheckboxCard
                        key={`${rbacModule}-${action.key}`}
                        label={action.label}
                        description={action.description}
                        checked={!!row.actions[action.key] || row.manage}
                        disabled={disabled || row.manage}
                        helper={row.manage ? "Granted by Manage" : undefined}
                        onChange={(checked) =>
                          setAction(rbacModule, action.key, checked)
                        }
                      />
                    ))}
                  </div>
                </div>

                {enabledLabels.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {enabledLabels.map((label) => (
                      <span
                        key={`${rbacModule}-${label}`}
                        className="rounded-full border border-border/70 bg-background/85 px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
