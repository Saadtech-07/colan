"use client";

import { Shield, UserCog, Users, GraduationCap, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLES = [
  {
    name: "Admin" as const,
    description:
      "Full workspace control — employees, projects, seating, gallery, and future permission policies.",
    icon: Crown,
    scope: ["All modules", "User administration (future)", "Org settings (future)"],
  },
  {
    name: "Manager" as const,
    description:
      "Operational oversight across teams with approval workflows and reporting.",
    icon: UserCog,
    scope: ["Projects", "Teams", "Reports (future)"],
  },
  {
    name: "Team Lead" as const,
    description:
      "Leads delivery for a squad — prioritization, standups, and unblockers.",
    icon: Shield,
    scope: ["Team backlog", "Assignments", "Rituals"],
  },
  {
    name: "Employee" as const,
    description:
      "Contributing member with read access to assigned team projects and workspace updates.",
    icon: Users,
    scope: ["Assigned projects", "Team announcements (future)"],
  },
  {
    name: "Intern" as const,
    description:
      "Learning path with guided access — expands as mentorship milestones complete.",
    icon: GraduationCap,
    scope: ["Shadow projects", "Training modules (future)"],
  },
];

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Roles</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Colan role model aligned with a future RBAC layer (Auth.js permissions,
          route guards, and API scopes).
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <Card
              key={role.name}
              className="border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      RBAC-ready
                    </Badge>
                  </div>
                  <CardDescription>{role.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Planned permissions
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {role.scope.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
