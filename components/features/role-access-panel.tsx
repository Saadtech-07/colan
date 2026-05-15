"use client";

import { CheckCircle2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccessContext } from "@/lib/permissions";
import { ROLE_DEFINITIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const PERMISSION_LABELS: Record<string, string> = {
  "employees:read": "View team directory",
  "employees:read_all": "View all employees",
  "employees:write": "Add & edit employees",
  "projects:read": "View team projects",
  "projects:read_all": "View all team projects",
  "projects:manage": "Manage projects (all teams)",
  "projects:manage_team": "Manage squad projects",
  "gallery:read": "Browse gallery",
  "gallery:write": "Publish gallery items",
  "seating:read": "View seating plan",
  "seating:assign": "Assign any bay",
  "seating:assign_team": "Assign team bays",
  "roles:read": "View role definitions",
};

type Props = {
  access: AccessContext;
  className?: string;
};

export function RoleAccessPanel({ access, className }: Props) {
  const def = access.definition;
  const otherRoles = Object.values(ROLE_DEFINITIONS).filter(
    (r) => r.role !== access.role,
  );

  return (
    <Card
      className={cn(
        "border-primary/20 bg-gradient-to-br from-primary/5 to-background",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <section className="mb-2 flex flex-wrap items-center gap-2">
          <Badge>{def.label}</Badge>
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
            {def.permissions.map((p) => (
              <li key={p}>
                <Badge variant="secondary" className="font-normal">
                  {PERMISSION_LABELS[p] ?? p}
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
              <li key={r.role} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.label}</span>
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
