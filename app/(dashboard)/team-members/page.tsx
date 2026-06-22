"use client";

import * as React from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Filter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { formatProjectDate } from "@/lib/project-ui";
import { profileNameInitial } from "@/lib/profile-image";
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

const ALL_TAB = "All";

const filterMenuTriggerClass =
  "cursor-pointer rounded-xl hover:bg-accent focus:bg-accent data-[state=open]:bg-accent";
const filterMenuItemClass =
  "cursor-pointer rounded-xl hover:bg-accent focus:bg-accent";

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 shrink-0">
            <SectionTitle as="h3">Team directory</SectionTitle>
            <p className={cn(sectionDescriptionClassName, "mt-0.5")}>
              Employee cards with projects, seat assignment, and profile access
            </p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" />
              <Input
                id="team-member-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, ID, email, team, or role"
                className="h-9 rounded-xl border border-black bg-background pl-9 text-sm shadow-none transition-colors focus:border-black focus:ring-2 focus:ring-black/10 focus-visible:border-black focus-visible:ring-2 focus-visible:ring-black/10 dark:border-neutral-200 dark:focus:border-neutral-200 dark:focus-visible:border-neutral-200"
              />
            </div>

            <DirectoryFiltersDropdown
              team={tab}
              role={roleTab}
              teamOptions={[
                { value: ALL_TAB, label: "All" },
                ...teamNames.map((team) => ({
                  value: team,
                  label: teamTabLabel(team),
                })),
              ]}
              roleOptions={roleFilterOptions}
              onTeamChange={setTab}
              onRoleChange={setRoleTab}
              activeCount={[tab !== ALL_TAB, roleTab !== "all"].filter(Boolean).length}
            />
          </div>
        </div>

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
                      {formatProjectDate(employee.directory?.joinedDate ?? "", {
                        emptyLabel: "Join date unavailable",
                      })}
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

function DirectoryFiltersDropdown({
  team,
  role,
  teamOptions,
  roleOptions,
  onTeamChange,
  onRoleChange,
  activeCount,
}: {
  team: string;
  role: string;
  teamOptions: Array<{ value: string; label: string }>;
  roleOptions: Array<{ value: string; label: string }>;
  onTeamChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  activeCount: number;
}) {
  const teamLabel = teamOptions.find((option) => option.value === team)?.label ?? "All";
  const roleLabel = roleOptions.find((option) => option.value === role)?.label ?? "All";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 rounded-xl border-border/70 bg-background px-3 text-sm"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 ? (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
              {activeCount}
            </span>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-none w-56 overflow-visible rounded-2xl border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur"
      >
        <DropdownMenuLabel className="px-2 text-xs text-muted-foreground">
          Refine directory
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/60" />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
            Team · {teamLabel}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 overflow-y-auto rounded-2xl border-border/60 p-1.5">
            <DropdownMenuRadioGroup value={team} onValueChange={onTeamChange}>
              {teamOptions.map((option) => (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  className={filterMenuItemClass}
                >
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
            Role · {roleLabel}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="rounded-2xl border-border/60 p-1.5">
            <DropdownMenuRadioGroup value={role} onValueChange={onRoleChange}>
              {roleOptions.map((option) => (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  className={filterMenuItemClass}
                >
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
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

