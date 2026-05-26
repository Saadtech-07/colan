"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronRight,
  Download,
  Filter,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundPlus,
  UserX2,
  Users2,
} from "lucide-react";
import { EditEmployeeDialog } from "@/components/features/edit-employee-dialog";
import { ManageEmployeeProjectsDialog } from "@/components/features/manage-employee-projects-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { employeeProfilePath } from "@/lib/employee-slug";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { canManageProject } from "@/lib/permissions";
import { teamTabLabel } from "@/lib/team-utils";
import {
  buildWorkforceAccess,
  employeeActiveProjects,
  employeeAssignedProjects,
  employeeAvailabilityState,
  employeeCompletionRate,
  employeeWorkloadPercent,
  employeeWorkspaceStatus,
  formatCsvValue,
  workforceAnalytics,
} from "@/lib/team-members-ui";
import { cn } from "@/lib/utils";

const ALL_TAB = "All";

const ROLE_TABS = [
  { key: "all", label: "All" },
  { key: "Team Lead", label: "Leads" },
  { key: "Manager", label: "Managers" },
  { key: "Employee", label: "Employees" },
  { key: "Intern", label: "Interns" },
] as const;

type FilterValue = "all" | "available" | "busy" | "capacity";
type AssignmentFilterValue = "all" | "with-projects" | "without-projects";
type SeatingFilterValue = "all" | "assigned" | "unassigned";

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function findCurrentEmployee(
  employees: ReturnType<typeof useAppState>["employees"],
  user: ReturnType<typeof useAppState>["user"],
) {
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  return (
    employees.find(
      (employee) => employee.directory?.workEmail?.trim().toLowerCase() === email,
    ) ??
    employees.find(
      (employee) =>
        employee.name.trim().toLowerCase() === user.name.trim().toLowerCase() &&
        (!user.team || employee.team === user.team),
    ) ??
    null
  );
}

function joinDateLabel(date?: string) {
  if (!date) return "Join date unavailable";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function floorZoneLabel(bayNumber: string) {
  if (!bayNumber) return "No workspace assigned";
  return `${bayNumber.charAt(0)}-Zone`;
}

export default function TeamMembersPage() {
  const router = useRouter();
  const { employees, projects, access, refreshData, teamNames, user } = useAppState();
  const { withLoading } = useGlobalLoading();
  const [tab, setTab] = React.useState<string>(ALL_TAB);
  const [roleTab, setRoleTab] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [availabilityFilter, setAvailabilityFilter] = React.useState<FilterValue>("all");
  const [assignmentFilter, setAssignmentFilter] =
    React.useState<AssignmentFilterValue>("all");
  const [seatingFilter, setSeatingFilter] = React.useState<SeatingFilterValue>("all");

  const workforceAccess = React.useMemo(
    () => buildWorkforceAccess(access),
    [access],
  );
  const currentEmployee = React.useMemo(
    () => findCurrentEmployee(employees, user),
    [employees, user],
  );

  const canManageProjectForUser = React.useCallback(
    (project: (typeof projects)[number]) =>
      !!access && canManageProject(access.role, project.teams, access.team),
    [access],
  );

  const teamScopedEmployees = React.useMemo(
    () => (tab === ALL_TAB ? employees : employees.filter((employee) => employee.team === tab)),
    [employees, tab],
  );

  const filteredEmployees = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return teamScopedEmployees.filter((employee) => {
      const availability = employeeAvailabilityState(employee, projects).label;
      const assignedProjects = employeeAssignedProjects(employee, projects);
      const seatAssigned = Boolean(employee.bayNumber);

      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.employeeId.toLowerCase().includes(query) ||
        employee.team.toLowerCase().includes(query) ||
        employee.role.toLowerCase().includes(query) ||
        employee.directory?.workEmail?.toLowerCase().includes(query);

      const matchesRole = roleTab === "all" || employee.role === roleTab;
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" && availability === "Available") ||
        (availabilityFilter === "busy" && availability === "Busy") ||
        (availabilityFilter === "capacity" && availability === "At capacity");
      const matchesAssignment =
        assignmentFilter === "all" ||
        (assignmentFilter === "with-projects" && assignedProjects.length > 0) ||
        (assignmentFilter === "without-projects" && assignedProjects.length === 0);
      const matchesSeating =
        seatingFilter === "all" ||
        (seatingFilter === "assigned" && seatAssigned) ||
        (seatingFilter === "unassigned" && !seatAssigned);

      return (
        matchesSearch &&
        matchesRole &&
        matchesAvailability &&
        matchesAssignment &&
        matchesSeating
      );
    });
  }, [
    assignmentFilter,
    availabilityFilter,
    projects,
    roleTab,
    search,
    seatingFilter,
    teamScopedEmployees,
  ]);

  const analytics = React.useMemo(
    () => workforceAnalytics(filteredEmployees, projects),
    [filteredEmployees, projects],
  );

  const exportDirectory = React.useCallback(() => {
    const rows = [
      [
        "Employee ID",
        "Name",
        "Team",
        "Role",
        "Work Email",
        "Phone",
        "Seat",
        "Assigned Projects",
        "Workload %",
      ],
      ...filteredEmployees.map((employee) => [
        employee.employeeId,
        employee.name,
        employee.team,
        employee.role,
        employee.directory?.workEmail ?? "",
        employee.directory?.phone ?? "",
        employee.bayNumber ?? "",
        employeeAssignedProjects(employee, projects).length,
        employeeWorkloadPercent(employee, projects),
      ]),
    ];

    const csv = rows.map((row) => row.map(formatCsvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "team-members-directory.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filteredEmployees, projects]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-background/75 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6">
        <div className="space-y-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                <Users2 className="h-3.5 w-3.5" />
                Workforce management
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Team Members
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Manage employees, roles, assignments, and workspace access.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {workforceAccess.canExportDirectory && (
                <Button
                  variant="outline"
                  className="h-11 rounded-2xl border-border/70 bg-background/80 px-5 shadow-sm"
                  onClick={exportDirectory}
                >
                  <Download className="h-4 w-4" />
                  Export Directory
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <AnalyticsCard
              icon={<Users2 className="h-5 w-5 text-primary" />}
              title="Total Employees"
              value={String(analytics.totalEmployees)}
              hint="Visible in current workspace filters"
            />
            <AnalyticsCard
              icon={<ShieldCheck className="h-5 w-5 text-indigo-500" />}
              title="Active Teams"
              value={String(analytics.activeTeams)}
              hint="Distinct teams in the current view"
            />
            <AnalyticsCard
              icon={<UserRoundCheck className="h-5 w-5 text-emerald-500" />}
              title="Team Leads"
              value={String(analytics.teamLeads)}
              hint="Leadership capacity across teams"
            />
            <AnalyticsCard
              icon={<UserX2 className="h-5 w-5 text-amber-500" />}
              title="Without Projects"
              value={String(analytics.employeesWithoutProjects)}
              hint="People available for new work"
            />
            <AnalyticsCard
              icon={<UserRoundPlus className="h-5 w-5 text-cyan-500" />}
              title="Available Employees"
              value={String(analytics.availableEmployees)}
              hint="Low current workload"
            />
            <AnalyticsCard
              icon={<BriefcaseBusiness className="h-5 w-5 text-violet-500" />}
              title="Active Projects Assigned"
              value={String(analytics.activeProjectsAssigned)}
              hint="Open project assignments in scope"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-border/70 bg-background/75 p-5 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6">
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, employee ID, email, team, or role"
                className="h-11 rounded-2xl border-border/70 bg-background/80 pl-10"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FilterSelect
                value={availabilityFilter}
                onValueChange={(value) => setAvailabilityFilter(value as FilterValue)}
                placeholder="Availability"
                options={[
                  { value: "all", label: "All availability" },
                  { value: "available", label: "Available" },
                  { value: "busy", label: "Busy" },
                  { value: "capacity", label: "At capacity" },
                ]}
              />
              <FilterSelect
                value={assignmentFilter}
                onValueChange={(value) =>
                  setAssignmentFilter(value as AssignmentFilterValue)
                }
                placeholder="Assignments"
                options={[
                  { value: "all", label: "All assignments" },
                  { value: "with-projects", label: "With projects" },
                  { value: "without-projects", label: "Without projects" },
                ]}
              />
              <FilterSelect
                value={seatingFilter}
                onValueChange={(value) => setSeatingFilter(value as SeatingFilterValue)}
                placeholder="Seating"
                options={[
                  { value: "all", label: "All seating" },
                  { value: "assigned", label: "Seat assigned" },
                  { value: "unassigned", label: "Seat unassigned" },
                ]}
              />
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="overflow-x-auto">
                <TabsList className="inline-flex h-11 min-w-max flex-nowrap items-center gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1 shadow-sm">
                  <TabsTrigger value={ALL_TAB} className="rounded-xl px-4 data-[state=active]:shadow-sm">
                    All teams
                  </TabsTrigger>
                  {teamNames.map((team) => (
                    <TabsTrigger
                      key={team}
                      value={team}
                      className="rounded-xl px-4 data-[state=active]:shadow-sm"
                    >
                      {teamTabLabel(team)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="overflow-x-auto">
                <div className="inline-flex min-w-max items-center gap-2 rounded-2xl border border-border/70 bg-muted/30 p-1.5">
                  {ROLE_TABS.map((role) => (
                    <button
                      key={role.key}
                      type="button"
                      onClick={() => setRoleTab(role.key)}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                        roleTab === role.key
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                      )}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Tabs>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {filteredEmployees.map((employee) => {
          const profileHref = employeeProfilePath(employee);
          const assigned = employeeAssignedProjects(employee, projects);
          const activeProjects = employeeActiveProjects(employee, projects);
          const workload = employeeWorkloadPercent(employee, projects);
          const completionRate = employeeCompletionRate(employee, projects);
          const availability = employeeAvailabilityState(employee, projects);
          const workspace = employeeWorkspaceStatus(employee);
          const isSelf = currentEmployee?.id === employee.id;

          return (
            <Card
              key={employee.id}
              className="group overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]"
            >
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 ring-2 ring-muted transition-transform duration-200 group-hover:scale-105">
                    <AvatarImage src={employee.imageUrl} alt={employee.name} />
                    <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">
                          {employee.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{employee.employeeId}</p>
                      </div>
                      <div
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          availability.toneClass,
                        )}
                      >
                        {availability.label}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="font-normal">
                        {employee.team}
                      </Badge>
                      <Badge variant="outline">{employee.role}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniMetric
                    label="Assigned projects"
                    value={`${activeProjects.length} active`}
                    hint={`${assigned.length} total`}
                  />
                  <MiniMetric
                    label="Workload"
                    value={`${workload}%`}
                    hint={`${completionRate}% completion`}
                  />
                  <MiniMetric
                    label="Workspace"
                    value={workspace.label}
                    hint={floorZoneLabel(employee.bayNumber)}
                  />
                  <MiniMetric
                    label="Join date"
                    value={joinDateLabel(employee.directory?.joinedDate)}
                    hint={employee.directory?.workEmail ?? "No work email"}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Workload progress</span>
                    <span>{workload}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/70">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        workload >= 85
                          ? "bg-gradient-to-r from-destructive to-rose-400"
                          : workload >= 55
                            ? "bg-gradient-to-r from-amber-500 to-orange-400"
                            : "bg-gradient-to-r from-primary via-indigo-500 to-cyan-400",
                      )}
                      style={{ width: `${workload}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                  {workforceAccess.canAssignProjects && (
                    <ManageEmployeeProjectsDialog
                      employee={employee}
                      projects={projects}
                      canManage={workforceAccess.canAssignProjects}
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

                  {workforceAccess.canManageEmployees && (
                    <EditEmployeeDialog
                      employee={employee}
                      projectCount={assigned.length}
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
                      triggerLabel="Edit"
                    />
                  )}

                  {(workforceAccess.canManageEmployees ||
                    workforceAccess.canAssignProjects ||
                    isSelf) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="ml-auto h-9 rounded-2xl border-border/70 bg-background/80 px-3 shadow-sm"
                      onClick={() => router.push(profileHref)}
                    >
                      View Profile
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {filteredEmployees.length === 0 && (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
            <Users2 className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="text-base font-semibold text-foreground">No team members match this view.</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Adjust your search or workforce filters to expand the directory results.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AnalyticsCard({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="border-border/70 bg-background/75 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/80">
        <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-2xl border-border/70 bg-background/95 backdrop-blur-xl">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="rounded-xl">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MiniMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/15 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
