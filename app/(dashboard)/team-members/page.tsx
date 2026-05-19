"use client";

import * as React from "react";
import { AddEmployeeDialog } from "@/components/features/add-employee-dialog";
import { EditEmployeeDialog } from "@/components/features/edit-employee-dialog";
import { EmployeeProjectsSection } from "@/components/features/employee-projects-section";
import { ManageEmployeeProjectsDialog } from "@/components/features/manage-employee-projects-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseApiError, useAppState } from "@/providers/app-state";
import { TEAMS } from "@/lib/constants";
import {
  canManageProjectForTeam,
  canManageProjects,
  filterProjectsForUser,
} from "@/lib/permissions";
import type { Employee } from "@/types";

const ALL_TAB = "All";

export default function TeamMembersPage() {
  const { employees, projects, addEmployee, access, refreshData } = useAppState();
  const [tab, setTab] = React.useState<string>(ALL_TAB);

  const visibleProjects = React.useMemo(
    () =>
      access
        ? filterProjectsForUser(projects, access.role, access.team)
        : [],
    [projects, access],
  );

  const canManageProject = React.useCallback(
    (team: Employee["team"]) =>
      !!access && canManageProjectForTeam(access.role, team, access.team),
    [access],
  );

  const handleCreateEmployee = async (employee: Omit<Employee, "id">) => {
    await addEmployee(employee);
    setTab(ALL_TAB);
  };

  const filtered =
    tab === ALL_TAB
      ? employees
      : employees.filter((e) => e.team === tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Team members
          </h1>
          <p className="mt-1 text-muted-foreground">
            Directory with teams, roles, bay assignments, and project membership.
          </p>
        </div>
        {access?.canWriteEmployees && (
          <AddEmployeeDialog onCreate={handleCreateEmployee} />
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="no-scrollbar h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto bg-muted/60 p-1">
          <TabsTrigger value={ALL_TAB} className="text-xs sm:text-sm">
            {ALL_TAB}
          </TabsTrigger>
          {TEAMS.map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs sm:text-sm">
              {t.replace(" Team", "")}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((emp) => (
              <Card
                key={emp.id}
                className="group overflow-hidden border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
              >
                <CardContent className="p-5">
                  <div className="flex gap-4">
                    <Avatar className="h-14 w-14 ring-2 ring-muted transition-transform duration-200 group-hover:scale-105">
                      <AvatarImage src={emp.imageUrl} alt={emp.name} />
                      <AvatarFallback>
                        {emp.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate font-semibold leading-tight">
                        {emp.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emp.employeeId}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge variant="secondary" className="font-normal">
                          {emp.team}
                        </Badge>
                        <Badge variant="outline">{emp.role}</Badge>
                      </div>
                      <EmployeeProjectsSection
                        employee={emp}
                        projects={visibleProjects}
                      />
                      {(access?.canWriteEmployees || access?.canManageProjects) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {access?.canManageProjects && (
                            <ManageEmployeeProjectsDialog
                              employee={emp}
                              projects={visibleProjects}
                              canManage={canManageProjects(access.role)}
                              canManageProject={canManageProject}
                              onUpdated={refreshData}
                            />
                          )}
                          {access?.canWriteEmployees && (
                            <EditEmployeeDialog
                              employee={emp}
                              onSave={async (id, patch) => {
                                const res = await fetch(`/api/employees/${id}`, {
                                  method: "PATCH",
                                  credentials: "include",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(patch),
                                });
                                if (!res.ok) throw new Error(await parseApiError(res));
                                await res.json();
                                await refreshData();
                              }}
                              onDelete={async (id) => {
                                const res = await fetch(`/api/employees/${id}`, {
                                  method: "DELETE",
                                  credentials: "include",
                                });
                                if (!res.ok) throw new Error(await parseApiError(res));
                                await res.json();
                                await refreshData();
                              }}
                            />
                          )}
                        </div>
                      )}
                      <p className="pt-2 text-sm">
                        <span className="text-muted-foreground">Bay: </span>
                        <span className="font-medium tabular-nums">
                          {emp.bayNumber || "Unassigned"}
                        </span>
                      </p>
                      {emp.directory &&
                        (emp.directory.workEmail ||
                          emp.directory.phone ||
                          emp.directory.location ||
                          emp.directory.joinedDate ||
                          emp.directory.notes) && (
                          <dl className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs">
                            <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
                              Directory (Atlas)
                            </dt>
                            {emp.directory.workEmail && (
                              <div className="flex gap-2">
                                <dt className="shrink-0 text-muted-foreground">Email</dt>
                                <dd className="min-w-0 truncate">{emp.directory.workEmail}</dd>
                              </div>
                            )}
                            {emp.directory.phone && (
                              <div className="flex gap-2">
                                <dt className="shrink-0 text-muted-foreground">Phone</dt>
                                <dd>{emp.directory.phone}</dd>
                              </div>
                            )}
                            {emp.directory.location && (
                              <div className="flex gap-2">
                                <dt className="shrink-0 text-muted-foreground">Location</dt>
                                <dd>{emp.directory.location}</dd>
                              </div>
                            )}
                            {emp.directory.joinedDate && (
                              <div className="flex gap-2">
                                <dt className="shrink-0 text-muted-foreground">Joined</dt>
                                <dd>{emp.directory.joinedDate}</dd>
                              </div>
                            )}
                            {emp.directory.notes && (
                              <div className="pt-1 text-muted-foreground">
                                {emp.directory.notes}
                              </div>
                            )}
                          </dl>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              No employees in this filter.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
