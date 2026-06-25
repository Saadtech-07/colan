"use client";

import * as React from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarClock,
  LayoutGrid,
  Mail,
  MessageCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCheck,
  UserX2,
  Users2,
  ArrowRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { employeeProfilePath } from "@/lib/employee-slug";
import { useAppState } from "@/providers/app-state";
import { teamTabLabel } from "@/lib/team-utils";
import {
  buildTeamMemberRoleFilterOptions,
  employeeActiveProjects,
  employeeMatchesProjectFilter,
  employeeMatchesRoleFilter,
  employeeMatchesStatusFilter,
  employeeWorkspaceStatus,
  type EmployeeWorkspaceStatus,
  workforceAnalytics,
} from "@/lib/team-members-ui";
import { formatProjectDate } from "@/lib/project-ui";
import { profileNameInitial } from "@/lib/profile-image";
import {
  employeeEligibleForSeating,
  employeeShowsInTeamMembersDirectory,
  isMeaningfulTeamName,
} from "@/lib/workspace-identity";
import {
  GRID_DIRECTORY_PAGE_SIZE,
  useClientPagination,
} from "@/lib/client-pagination";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  SectionTitle,
  sectionDescriptionClassName,
  SubsectionTitle,
} from "@/components/ui/page-typography";
import { cn } from "@/lib/utils";
import type { PersonStatus } from "@/types";

const ALL_TEAMS = "all";
const ALL_PROJECTS = "all";
const ALL_ROLES = "all";
const ALL_STATUS = "all";

const STATUS_OPTIONS: PersonStatus[] = ["Active", "On Leave", "Inactive"];

const defaultFilters = {
  search: "",
  team: ALL_TEAMS,
  project: ALL_PROJECTS,
  role: ALL_ROLES,
  status: ALL_STATUS,
};

export function TeamMembersDirectoryModule() {
  const { employees, projects, teamNames, workspaceRoles } = useAppState();
  const [filters, setFilters] = React.useState(defaultFilters);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const roleFilterOptions = React.useMemo(
    () => buildTeamMemberRoleFilterOptions(workspaceRoles),
    [workspaceRoles],
  );

  React.useEffect(() => {
    if (filters.role === ALL_ROLES) return;
    if (!roleFilterOptions.some((option) => option.value === filters.role)) {
      setFilters((current) => ({ ...current, role: ALL_ROLES }));
    }
  }, [filters.role, roleFilterOptions]);

  const filteredEmployees = React.useMemo(() => {
    const query = filters.search.trim().toLowerCase();

    return employees.filter((employee) => {
      if (!employeeShowsInTeamMembersDirectory(employee)) {
        return false;
      }

      const matchesTeam =
        filters.team === ALL_TEAMS || employee.team === filters.team;

      const matchesProject = employeeMatchesProjectFilter(
        employee,
        filters.project,
        projects,
      );

      const matchesRole = employeeMatchesRoleFilter(
        employee,
        filters.role,
        workspaceRoles,
      );

      const matchesStatus = employeeMatchesStatusFilter(employee, filters.status);

      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.employeeId.toLowerCase().includes(query) ||
        employee.role.toLowerCase().includes(query) ||
        employee.directory?.workEmail?.toLowerCase().includes(query) ||
        employee.email?.toLowerCase().includes(query);

      return (
        matchesTeam && matchesProject && matchesRole && matchesStatus && matchesSearch
      );
    });
  }, [employees, filters, projects, workspaceRoles]);

  const {
    page,
    setPage,
    pageItems: paginatedEmployees,
    totalPages,
    totalItems: paginatedTotal,
    rangeStart,
    rangeEnd,
  } = useClientPagination(filteredEmployees, GRID_DIRECTORY_PAGE_SIZE, [filters]);

  const analytics = React.useMemo(
    () => workforceAnalytics(filteredEmployees, projects),
    [filteredEmployees, projects],
  );

  const activeFilterCount = [
    filters.team !== ALL_TEAMS,
    filters.project !== ALL_PROJECTS,
    filters.role !== ALL_ROLES,
    filters.status !== ALL_STATUS,
    filters.search.trim().length > 0,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilters(defaultFilters);
    setFiltersOpen(false);
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <SummaryCard
          title="Total Employees"
          value={String(analytics.totalEmployees)}
          icon={Users2}
          toneClass="from-indigo-500/12 via-indigo-500/6 to-transparent text-indigo-600 dark:text-indigo-300"
        />
        <SummaryCard
          title="Active Teams"
          value={String(analytics.activeTeams)}
          icon={ShieldCheck}
          toneClass="from-violet-500/12 via-violet-500/6 to-transparent text-violet-600 dark:text-violet-300"
        />
        <SummaryCard
          title="Project Lead"
          value={String(analytics.projectLeads)}
          icon={UserRoundCheck}
          toneClass="from-emerald-500/12 via-emerald-500/6 to-transparent text-emerald-600 dark:text-emerald-300"
        />
        <SummaryCard
          title="Without Projects"
          value={String(analytics.employeesWithoutProjects)}
          icon={UserX2}
          toneClass="from-amber-500/12 via-amber-500/6 to-transparent text-amber-700 dark:text-amber-300"
        />
        <SummaryCard
          title="Active Projects Assigned"
          value={String(analytics.activeProjectsAssigned)}
          icon={BriefcaseBusiness}
          toneClass="from-cyan-500/12 via-cyan-500/6 to-transparent text-cyan-600 dark:text-cyan-300"
        />
      </section>

      <section className="space-y-4">
        <div className="min-w-0">
          <SectionTitle as="h3">Team directory</SectionTitle>
          <p className={cn(sectionDescriptionClassName, "mt-0.5")}>
            Employee cards with projects, seat assignment, and profile access
          </p>
        </div>

        <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur-xl">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="team-member-search"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder="Search employee by name, ID, email, or role"
                  className="h-9 rounded-xl pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("h-9 rounded-xl", filtersOpen && "border-primary/40 bg-primary/5")}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 ? (
                  <Badge variant="secondary" className="ml-2 h-5 rounded-full px-1.5 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
                disabled={activeFilterCount === 0}
                onClick={resetFilters}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            </div>

            {filtersOpen ? (
              <div className="grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2 xl:grid-cols-4">
                <FilterField label="Team">
                  <Select
                    value={filters.team}
                    onValueChange={(value) =>
                      setFilters((current) => ({ ...current, team: value }))
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue placeholder="All Teams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_TEAMS}>All Teams</SelectItem>
                      {teamNames.map((team) => (
                        <SelectItem key={team} value={team}>
                          {teamTabLabel(team)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField label="Project">
                  <Select
                    value={filters.project}
                    onValueChange={(value) =>
                      setFilters((current) => ({ ...current, project: value }))
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_PROJECTS}>All Projects</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField label="Role">
                  <Select
                    value={filters.role}
                    onValueChange={(value) =>
                      setFilters((current) => ({ ...current, role: value }))
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label === "All" ? "All Roles" : option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField label="Status">
                  <Select
                    value={filters.status}
                    onValueChange={(value) =>
                      setFilters((current) => ({ ...current, status: value }))
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_STATUS}>All Status</SelectItem>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              {filteredEmployees.length === 0
                ? "No employees match your filters"
                : `Showing ${filteredEmployees.length} employee${filteredEmployees.length === 1 ? "" : "s"}`}
            </p>
          </CardContent>
        </Card>

        {filteredEmployees.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedEmployees.map((employee) => {
              const profileHref = employeeProfilePath(employee);
              const activeProjects = employeeActiveProjects(employee, projects);
              const workspace = employeeWorkspaceStatus(employee);
              const visibleProjects = activeProjects.slice(0, 3);
              const remainingProjects = activeProjects.length - visibleProjects.length;

              return (
                <Card
                  key={employee.id}
                  className="group overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]"
                >
                  <CardContent className="space-y-5 p-5">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14 ring-2 ring-muted transition-transform duration-200 group-hover:scale-105">
                        <AvatarImage src={employee.imageUrl} alt={employee.name} />
                        <AvatarFallback>{profileNameInitial(employee.name)}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-foreground">
                            {employee.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            User ID · {employee.employeeId}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {isMeaningfulTeamName(employee.team) ? (
                            <Badge variant="secondary" className="font-normal">
                              {employee.team}
                            </Badge>
                          ) : null}
                          <Badge variant="outline">{employee.role}</Badge>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          asChild
                        >
                          <Link
                            href={`/chat?with=${employee.id}`}
                            aria-label={`Message ${employee.name}`}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          asChild
                        >
                          <Link href={profileHref} aria-label={`View ${employee.name} profile`}>
                            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <MemberInfoSection title="Current projects" icon={BriefcaseBusiness}>
                      {visibleProjects.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No active project assigned</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {visibleProjects.map((project) => (
                            <span
                              key={project.id}
                              className="max-w-full truncate rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-foreground"
                              title={project.name}
                            >
                              {project.name}
                            </span>
                          ))}
                          {remainingProjects > 0 ? (
                            <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                              +{remainingProjects} more
                            </span>
                          ) : null}
                        </div>
                      )}
                    </MemberInfoSection>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {employeeEligibleForSeating(employee) ? (
                        <SeatAssignmentBlock workspace={workspace} />
                      ) : null}
                      <MemberInfoSection title="Join date" icon={CalendarClock}>
                        <p className="text-sm font-semibold text-foreground">
                          {formatProjectDate(employee.directory?.joinedDate ?? "", {
                            emptyLabel: "Join date unavailable",
                          })}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {employee.directory?.workEmail ?? employee.email ?? "No work email"}
                          </span>
                        </p>
                      </MemberInfoSection>
                    </div>

                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        <ListPagination
          page={page}
          totalPages={totalPages}
          totalItems={paginatedTotal}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={setPage}
        />
      </section>

      {filteredEmployees.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
            <Users2 className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="text-base font-semibold text-foreground">
              No team members match this view.
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Adjust your search or filters, or reset to show the full employee directory.
            </p>
            {activeFilterCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 rounded-xl"
                onClick={resetFilters}
              >
                Reset Filters
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  toneClass,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  toneClass: string;
}) {
  return (
    <Card className="group relative overflow-hidden border-border/70 bg-background/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
      <div className={cn("absolute inset-0 bg-gradient-to-br", toneClass)} />
      <CardContent className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5 shadow-sm transition-transform duration-300 group-hover:scale-105">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberInfoSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <SubsectionTitle>{title}</SubsectionTitle>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SeatAssignmentBlock({ workspace }: { workspace: EmployeeWorkspaceStatus }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-muted/15 p-4",
        !workspace.isAssigned && "border-dashed",
      )}
    >
      <div className="flex items-center gap-2">
        <LayoutGrid
          className={cn(
            "h-4 w-4",
            workspace.isAssigned ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        />
        <SubsectionTitle>Seat assignment</SubsectionTitle>
      </div>
      {workspace.isAssigned ? (
        <>
          <p className="mt-3 text-base font-semibold leading-6 text-emerald-900 dark:text-emerald-100">
            {workspace.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {workspace.zoneLabel} · office floor plan
          </p>
        </>
      ) : (
        <p className="mt-3 min-h-[1.5rem] text-xs text-muted-foreground">
          No seat on the seating arrangement yet
        </p>
      )}
    </div>
  );
}
