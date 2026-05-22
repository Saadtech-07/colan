"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AddEmployeeDialog } from "@/components/features/add-employee-dialog";
import { EditEmployeeDialog } from "@/components/features/edit-employee-dialog";
import { ManageEmployeeProjectsDialog } from "@/components/features/manage-employee-projects-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { employeeProfilePath } from "@/lib/employee-slug";
import { getProjectsForEmployee } from "@/lib/project-assignments";
import { filterProjectsByEmployeeTeam } from "@/lib/projects";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { teamTabLabel } from "@/lib/team-utils";
import {
  canAssignEmployeeProjects,
  canManageProject,
} from "@/lib/permissions";
import type { Employee } from "@/types";

const ALL_TAB = "All";

export default function TeamMembersPage() {
  const router = useRouter();
  const { employees, projects, addEmployee, access, refreshData, teamNames } =
    useAppState();
  const { withLoading } = useGlobalLoading();
  const [tab, setTab] = React.useState<string>(ALL_TAB);

  const canManageProjectForUser = React.useCallback(
    (project: (typeof projects)[number]) =>
      !!access && canManageProject(access.role, project.teams, access.team),
    [access, projects],
  );

  const handleCreateEmployee = async (employee: Omit<Employee, "id">) => {
    await withLoading("employee-create", LOADING_PRESETS.creatingEmployee, async () => {
      await addEmployee(employee);
      setTab(ALL_TAB);
    });
  };

  const filtered =
    tab === ALL_TAB ? employees : employees.filter((e) => e.team === tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Team members</h1>
          <p className="mt-1 text-muted-foreground">
            Browse the directory — open a profile for full details, projects, and seating.
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
          {teamNames.map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs sm:text-sm">
              {teamTabLabel(t)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((emp) => {
              const profileHref = employeeProfilePath(emp);
              const projectCount = filterProjectsByEmployeeTeam(
                emp,
                getProjectsForEmployee(emp.id, projects),
              ).length;

              return (
                <Card
                  key={emp.id}
                  className="group overflow-hidden border-border/70 transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
                >
                  <Link
                    href={profileHref}
                    className="block p-5 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex gap-4">
                      <Avatar className="h-14 w-14 ring-2 ring-muted transition-transform duration-200 group-hover:scale-105">
                        <AvatarImage src={emp.imageUrl} alt={emp.name} />
                        <AvatarFallback>
                          {emp.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-semibold leading-tight group-hover:text-primary">
                            {emp.name}
                          </p>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className="text-xs text-muted-foreground">{emp.employeeId}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Badge variant="secondary" className="font-normal">
                            {emp.team}
                          </Badge>
                          <Badge variant="outline">{emp.role}</Badge>
                        </div>
                        <p className="pt-2 text-xs text-muted-foreground">
                          {emp.bayNumber ? (
                            <>
                              Seat <span className="font-mono font-medium text-foreground">{emp.bayNumber}</span>
                            </>
                          ) : (
                            "No seat assigned"
                          )}
                          {projectCount > 0 && (
                            <>
                              {" · "}
                              {projectCount} project{projectCount === 1 ? "" : "s"}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </Link>

                  {(access?.canWriteEmployees || access?.canManageProjects) && (
                    <div
                      className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 px-5 py-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {access && canAssignEmployeeProjects(access.role) && (
                        <ManageEmployeeProjectsDialog
                          employee={emp}
                          projects={projects}
                          canManage={canAssignEmployeeProjects(access.role)}
                          canManageProject={canManageProjectForUser}
                          onUpdated={() =>
                            withLoading(
                              "employee-projects",
                              LOADING_PRESETS.updatingProjectMembership,
                              refreshData,
                            )
                          }
                        />
                      )}
                      {access?.canWriteEmployees && (
                        <EditEmployeeDialog
                          employee={emp}
                          onSave={async (id, patch) => {
                            await withLoading(
                              "employee-save",
                              LOADING_PRESETS.updatingEmployee,
                              async () => {
                                const res = await fetch(`/api/employees/${id}`, {
                                  method: "PATCH",
                                  credentials: "include",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(patch),
                                });
                                if (!res.ok) throw new Error(await parseApiError(res));
                                await res.json();
                                await refreshData();
                              },
                            );
                          }}
                          onDelete={async (id) => {
                            await withLoading(
                              "employee-delete",
                              LOADING_PRESETS.removingEmployee,
                              async () => {
                                const res = await fetch(`/api/employees/${id}`, {
                                  method: "DELETE",
                                  credentials: "include",
                                });
                                if (!res.ok) throw new Error(await parseApiError(res));
                                await refreshData();
                              },
                            );
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => router.push(profileHref)}
                        className="ml-auto text-xs font-medium text-primary hover:underline"
                      >
                        View profile
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
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
