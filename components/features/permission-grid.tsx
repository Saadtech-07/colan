"use client";

import { MODULE_LABELS, RBAC_MODULES, type ModulePermissionsMap } from "@/lib/rbac-modules";
import { cn } from "@/lib/utils";

type Props = {
  value: ModulePermissionsMap;
  onChange: (next: ModulePermissionsMap) => void;
  disabled?: boolean;
};

export function PermissionGrid({ value, onChange, disabled }: Props) {
  const setModule = (
    mod: (typeof RBAC_MODULES)[number],
    patch: Partial<{ view: boolean; manage: boolean }>,
  ) => {
    const current = value[mod];
    const manage = patch.manage ?? current.manage;
    const view = patch.view ?? (manage ? true : current.view);
    onChange({
      ...value,
      [mod]: {
        view: manage ? true : view,
        manage,
      },
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border/80">
      <div className="grid grid-cols-[1fr_auto_auto] gap-px bg-border/80 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <div className="bg-muted/50 px-3 py-2">Module</div>
        <div className="bg-muted/50 px-3 py-2 text-center">View</div>
        <div className="bg-muted/50 px-3 py-2 text-center">Manage</div>
      </div>
      {RBAC_MODULES.map((mod) => {
        const labels = MODULE_LABELS[mod];
        const row = value[mod];
        return (
          <div
            key={mod}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-px border-t border-border/60 bg-card"
          >
            <div className="px-3 py-2.5">
              <p className="text-sm font-medium">{labels.title}</p>
              <p className="text-xs text-muted-foreground">
                Manage includes full control (create, edit, delete).
              </p>
            </div>
            <label
              className={cn(
                "flex justify-center px-3 py-2.5",
                disabled && "opacity-60",
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={row.view}
                disabled={disabled || row.manage}
                onChange={(e) => setModule(mod, { view: e.target.checked })}
              />
            </label>
            <label
              className={cn(
                "flex justify-center px-3 py-2.5",
                disabled && "opacity-60",
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={row.manage}
                disabled={disabled}
                onChange={(e) => setModule(mod, { manage: e.target.checked })}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}
