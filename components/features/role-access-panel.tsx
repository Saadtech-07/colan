"use client";

import { CheckCircle2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MODULE_LABELS, RBAC_MODULES } from "@/lib/rbac-modules";
import type { AccessContext } from "@/lib/permissions";
import { useAppState } from "@/providers/app-state";
import { cn } from "@/lib/utils";

type Props = {
  access: AccessContext;
  className?: string;
};

export function RoleAccessPanel({ access, className }: Props) {
  const { workspaceRoles } = useAppState();
  const def = access.definition;
  const otherRoles = workspaceRoles.filter((r) => r.key !== access.role);

  const enabledModules = RBAC_MODULES.filter((m) => access.canView(m)).map((m) => {
    const label = MODULE_LABELS[m].title;
    return access.canManage(m) ? `${label} (Manage)` : `${label} (View)`;
  });

  return (
    <Card
      className={cn(
        "border-primary/20 bg-gradient-to-br from-primary/5 to-background",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <section className="mb-2 flex flex-wrap items-center gap-2">
          <Badge style={{ backgroundColor: def.color, color: "#fff" }}>{def.label}</Badge>
          {access.team && <Badge variant="outline">{access.team}</Badge>}
        </section>
        <CardTitle className="text-lg">Your access</CardTitle>
        <CardDescription>{def.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Responsibilities
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {def.responsibilities.map((r) => (
              <li key={r} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What you can do now
          </p>
          <ul className="flex flex-wrap gap-2">
            {enabledModules.map((label) => (
              <li key={label}>
                <Badge variant="secondary" className="font-normal">
                  {label}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-dashed border-border/80 bg-muted/30 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Other roles in Colan
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {otherRoles.map((r) => (
              <li key={r.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.name}</span>
                {" — "}
                {r.description}
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
