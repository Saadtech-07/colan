"use client";

import { Crown, Shield, UserCog, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_DEFINITIONS } from "@/lib/permissions";
import { useAppState } from "@/providers/app-state";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types";

const ROLE_ICONS: Record<AppRole, typeof Crown> = {
  admin: Crown,
  manager: UserCog,
  lead: Shield,
  employee: Users,
};

export default function RolesPage() {
  const { access, user } = useAppState();
  const currentRole = access?.role;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Roles &amp; access
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          {user?.name ? (
            <>
              Signed in as <span className="font-medium text-foreground">{user.name}</span>
              {access && (
                <>
                  {" "}
                  with the <span className="font-medium text-foreground">{access.definition.label}</span> role
                  {access.team ? ` on ${access.team}` : ""}. Modules and actions below reflect what you can use today.
                </>
              )}
            </>
          ) : (
            "Role-based access for Colan workspace modules."
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.values(ROLE_DEFINITIONS).map((role) => {
          const Icon = ROLE_ICONS[role.role];
          const isCurrent = currentRole === role.role;
          return (
            <Card
              key={role.role}
              className={cn(
                "border-border/70 transition-all duration-200",
                isCurrent
                  ? "border-primary/50 bg-primary/5 shadow-md ring-1 ring-primary/20"
                  : "hover:-translate-y-0.5 hover:shadow-md",
              )}
            >
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    isCurrent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">{role.label}</CardTitle>
                    {isCurrent && (
                      <Badge className="text-[10px] uppercase">Your role</Badge>
                    )}
                  </div>
                  <CardDescription>{role.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Responsibilities
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {role.responsibilities.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Access scope
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {role.scopes.map((s) => (
                      <li key={s}>
                        <Badge variant="outline" className="font-normal">
                          {s}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
