"use client";

import * as React from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  LayoutGrid,
  Mail,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserX2,
  Users2,
} from "lucide-react";
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
import { employeeProfilePath } from "@/lib/employee-slug";
import { useAppState } from "@/providers/app-state";
import { teamTabLabel } from "@/lib/team-utils";
import {
  buildTeamMemberRoleFilterOptions,
  employeeActiveProjects,
  employeeMatchesRoleFilter,
  employeeWorkspaceStatus,
  type EmployeeWorkspaceStatus,
  workforceAnalytics,
} from "@/lib/team-members-ui";
import { profileNameInitial } from "@/lib/profile-image";
import {
  GRID_DIRECTORY_PAGE_SIZE,
  useClientPagination,
} from "@/lib/client-pagination";
import { ListPagination } from "@/components/ui/list-pagination";
import { cn } from "@/lib/utils";

const ALL_TAB = "All";

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

export default function TeamMembersPage() {
  const { employees, projects, teamNames, workspaceRoles } = useAppState();
  const [tab, setTab] = React.useState<string>(ALL_TAB);
  const [roleTab, setRoleTab] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const roleFilterOptions = React.useMemo(
    () => buildTeamMemberRoleFilterOptions(workspaceRoles),
    [workspaceRoles],
  );

  React.useEffect(() => {
    if (roleTab === "all") return;
    if (!roleFilterOptions.some((option) => option.value === roleTab)) {
      setRoleTab("all");
    }
  }, [roleFilterOptions, roleTab]);

  const teamScopedEmployees = React.useMemo(
    () => (tab === ALL_TAB ? employees : employees.filter((employee) => employee.team === tab)),
    [employees, tab],
  );

  const filteredEmployees = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return teamScopedEmployees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.employeeId.toLowerCase().includes(query) ||
        employee.team.toLowerCase().includes(query) ||
        employee.role.toLowerCase().includes(query) ||
        employee.directory?.workEmail?.toLowerCase().includes(query);

      const matchesRole = employeeMatchesRoleFilter(employee, roleTab, workspaceRoles);

      return matchesSearch && matchesRole;
    });
  }, [roleTab, search, teamScopedEmployees, workspaceRoles]);

  const {
    page,
    setPage,
    pageItems: paginatedEmployees,
    totalPages,
    totalItems: paginatedTotal,
    rangeStart,
    rangeEnd,
  } = useClientPagination(filteredEmployees, GRID_DIRECTORY_PAGE_SIZE, [
    search,
    tab,
    roleTab,
  ]);

  const analytics = React.useMemo(
    () => workforceAnalytics(filteredEmployees, projects),
    [filteredEmployees, projects],
  );

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
          title="Team Leads"
          value={String(analytics.teamLeads)}
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

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/75 p-4 shadow-sm backdrop-blur-xl sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Search className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Search directory</h3>
          </div>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-medium">
            {filteredEmployees.length} result{filteredEmployees.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              id="team-member-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, ID, email, team, or role"
              className="h-10 rounded-xl border-2 border-primary/20 bg-background pl-9 text-sm shadow-sm focus-visible:border-primary/40"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 lg:shrink-0">
            <FilterDropdown
              label="Team"
              value={tab}
              onValueChange={setTab}
              options={[
                { value: ALL_TAB, label: "All" },
                ...teamNames.map((team) => ({
                  value: team,
                  label: teamTabLabel(team),
                })),
              ]}
            />
            <FilterDropdown
              label="Role"
              value={roleTab}
              onValueChange={setRoleTab}
              options={roleFilterOptions}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Team directory
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Employee cards with projects, seat assignment, and profile access
            </p>
          </div>
          <Badge variant="outline" className="rounded-full border-border/70 bg-background/80 px-3 py-1">
            {paginatedTotal === 0
              ? "No members"
              : totalPages > 1
                ? `Showing ${rangeStart}–${rangeEnd} of ${paginatedTotal}`
                : `Showing ${paginatedTotal} member${paginatedTotal === 1 ? "" : "s"}`}
          </Badge>
        </div>

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
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">
                          {employee.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{employee.employeeId}</p>
                      </div>
                      <Link
                        href={profileHref}
                        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:text-primary"
                      >
                        View Profile
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="font-normal">
                        {employee.team}
                      </Badge>
                      <Badge variant="outline">{employee.role}</Badge>
                    </div>
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
                      {remainingProjects > 0 && (
                        <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                          +{remainingProjects} more
                        </span>
                      )}
                    </div>
                  )}
                </MemberInfoSection>

                <div className="grid gap-3 sm:grid-cols-2">
                  <SeatAssignmentBlock workspace={workspace} />
                  <MemberInfoSection title="Join date" icon={CalendarClock}>
                    <p className="text-sm font-semibold text-foreground">
                      {joinDateLabel(employee.directory?.joinedDate)}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {employee.directory?.workEmail ?? "No work email"}
                      </span>
                    </p>
                  </MemberInfoSection>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>

        <ListPagination
          page={page}
          totalPages={totalPages}
          totalItems={paginatedTotal}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={setPage}
          className="px-1"
        />
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

function FilterDropdown({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs font-bold text-foreground">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-10 w-[min(100%,9.5rem)] min-w-[7.5rem] rounded-xl border border-border/70 bg-background/80 px-3 text-sm font-medium shadow-sm sm:w-36">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border/70 bg-background/95 backdrop-blur-xl">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="rounded-lg text-sm">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
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
        <h4 className="text-sm font-bold text-foreground">Seat assignment</h4>
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

