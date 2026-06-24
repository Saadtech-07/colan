"use client";

import * as React from "react";
import { CalendarDays, Loader2, NotebookPen, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/ui/page-typography";
import { isProjectManagerAppRole } from "@/lib/project-managers";
import { teamTabLabel } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import { parseApiError, useAppState } from "@/providers/app-state";
import type { CompanyRole, DailyUpdate, TeamName } from "@/types";

const ALL_TEAMS = "all";
const ALL_ROLES = "all";

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isOversightViewer(access: ReturnType<typeof useAppState>["access"]) {
  if (!access) return false;
  return (
    access.canManageProjects ||
    access.role === "admin" ||
    access.role === "manager" ||
    isProjectManagerAppRole(access.role)
  );
}

export function DailyUpdatesModule() {
  const { projects, employees, teamNames, access } = useAppState();
  const [updates, setUpdates] = React.useState<DailyUpdate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [filterProject, setFilterProject] = React.useState("all");
  const [filterDate, setFilterDate] = React.useState("");
  const [filterTeam, setFilterTeam] = React.useState(ALL_TEAMS);
  const [filterRole, setFilterRole] = React.useState(ALL_ROLES);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    projectId: projects[0]?.id ?? "",
    date: todayIso(),
    workDone: "",
    blockers: "",
    tomorrowPlan: "",
  });

  const oversightViewer = isOversightViewer(access);
  const canSubmitUpdate = !oversightViewer;

  React.useEffect(() => {
    if (!form.projectId && projects[0]?.id) {
      setForm((prev) => ({ ...prev, projectId: projects[0].id }));
    }
  }, [form.projectId, projects]);

  const employeeById = React.useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const roleFilterOptions = React.useMemo(() => {
    const roles = new Set<CompanyRole>();
    for (const employee of employees) roles.add(employee.role);
    return [...roles].sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const loadUpdates = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterProject !== "all") params.set("projectId", filterProject);
      if (filterDate) {
        params.set("dateFrom", filterDate);
        params.set("dateTo", filterDate);
      }
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/daily-updates?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setUpdates((await res.json()) as DailyUpdate[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load updates");
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterProject, search]);

  React.useEffect(() => {
    void loadUpdates();
  }, [loadUpdates]);

  const filteredUpdates = React.useMemo(() => {
    return updates.filter((update) => {
      const employee = employeeById.get(update.employeeId);
      if (filterTeam !== ALL_TEAMS && employee?.team !== filterTeam) return false;
      if (filterRole !== ALL_ROLES && employee?.role !== filterRole) return false;
      return true;
    });
  }, [employeeById, filterRole, filterTeam, updates]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Map<string, DailyUpdate[]>>();
    for (const update of filteredUpdates) {
      const dateBucket = map.get(update.date) ?? new Map<string, DailyUpdate[]>();
      const projectBucket = dateBucket.get(update.projectId) ?? [];
      projectBucket.push(update);
      dateBucket.set(update.projectId, projectBucket);
      map.set(update.date, dateBucket);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredUpdates]);

  const activeFilterCount = [
    filterProject !== "all",
    filterDate.length > 0,
    filterTeam !== ALL_TEAMS,
    filterRole !== ALL_ROLES,
    search.trim().length > 0,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setFilterProject("all");
    setFilterDate("");
    setFilterTeam(ALL_TEAMS);
    setFilterRole(ALL_ROLES);
    setFiltersOpen(false);
  };

  const globalFilterBar = (
    <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur-xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search updates..."
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
            <FilterSelect
              label="Project"
              value={filterProject}
              onChange={setFilterProject}
              options={[
                { value: "all", label: "All projects" },
                ...projects.map((project) => ({ value: project.id, label: project.name })),
              ]}
            />
            <FilterSelect
              label="Team"
              value={filterTeam}
              onChange={(value) => setFilterTeam(value as typeof ALL_TEAMS | TeamName)}
              options={[
                { value: ALL_TEAMS, label: "All teams" },
                ...teamNames.map((team) => ({
                  value: team,
                  label: `${teamTabLabel(team)} team`,
                })),
              ]}
            />
            <FilterSelect
              label="Role"
              value={filterRole}
              onChange={(value) => setFilterRole(value as typeof ALL_ROLES | CompanyRole)}
              options={[
                { value: ALL_ROLES, label: "All roles" },
                ...roleFilterOptions.map((role) => ({ value: role, label: role })),
              ]}
            />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input
                type="date"
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
                className="h-9 rounded-xl"
              />
            </div>
          </div>
        ) : null}

        {activeFilterCount > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filterProject !== "all" ? (
              <FilterChip
                label={`Project: ${projects.find((project) => project.id === filterProject)?.name ?? "Selected"}`}
                onRemove={() => setFilterProject("all")}
              />
            ) : null}
            {filterTeam !== ALL_TEAMS ? (
              <FilterChip
                label={`Team: ${teamTabLabel(filterTeam)}`}
                onRemove={() => setFilterTeam(ALL_TEAMS)}
              />
            ) : null}
            {filterRole !== ALL_ROLES ? (
              <FilterChip label={`Role: ${filterRole}`} onRemove={() => setFilterRole(ALL_ROLES)} />
            ) : null}
            {filterDate ? (
              <FilterChip label={`Date: ${formatDate(filterDate)}`} onRemove={() => setFilterDate("")} />
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {activeFilterCount > 0
            ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied · ${filteredUpdates.length} update${filteredUpdates.length === 1 ? "" : "s"}`
            : `Showing ${filteredUpdates.length} update${filteredUpdates.length === 1 ? "" : "s"}`}
        </p>
      </CardContent>
    </Card>
  );

  const submitUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-updates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setForm((prev) => ({ ...prev, workDone: "", blockers: "", tomorrowPlan: "" }));
      await loadUpdates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-4.25rem-2rem)] max-h-[calc(100dvh-4.25rem-2rem)] flex-col gap-4 overflow-hidden sm:h-[calc(100dvh-4.25rem-3rem)] sm:max-h-[calc(100dvh-4.25rem-3rem)] lg:h-[calc(100dvh-4.25rem-4rem)] lg:max-h-[calc(100dvh-4.25rem-4rem)]">
      <div className="shrink-0">{globalFilterBar}</div>

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-4 overflow-hidden",
          canSubmitUpdate && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]",
        )}
      >
        {canSubmitUpdate ? (
          <Card className="flex min-h-0 flex-col overflow-hidden border-border/70 bg-background/75 shadow-sm backdrop-blur-xl">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <NotebookPen className="h-4 w-4" />
                Submit update
              </CardTitle>
            </CardHeader>
            <CardContent className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <form onSubmit={submitUpdate} className="space-y-4">
                <Field label="Project">
                  <Select
                    value={form.projectId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, projectId: value }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date">
                  <Input
                    type="date"
                    required
                    value={form.date}
                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Work done">
                  <Textarea
                    required
                    rows={4}
                    value={form.workDone}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, workDone: event.target.value }))
                    }
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Blockers">
                  <Textarea
                    rows={3}
                    value={form.blockers}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, blockers: event.target.value }))
                    }
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Tomorrow plan">
                  <Textarea
                    required
                    rows={3}
                    value={form.tomorrowPlan}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, tomorrowPlan: event.target.value }))
                    }
                    className="rounded-xl"
                  />
                </Field>
                <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit daily update
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 bg-background/75 shadow-sm backdrop-blur-xl">
          <CardHeader className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-5">
            <SectionTitle as="h2" className="text-base">
              {oversightViewer ? "Employee updates" : "My updates"}
            </SectionTitle>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            {error ? (
              <p className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:mx-5">
                {error}
              </p>
            ) : null}

            {loading ? (
              <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading updates...
              </div>
            ) : grouped.length === 0 ? (
              <div className="mx-4 my-4 flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 py-10 text-center sm:mx-5">
                <div>
                  <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                  <p className="font-medium">No daily updates match your filters.</p>
                </div>
              </div>
            ) : (
              <div className="scrollbar-none h-full min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
                <div className="space-y-8">
                  {grouped.map(([date, projectMap]) => (
                    <div key={date} className="relative border-l border-border/60 pl-5">
                      <div className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-primary" />
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="rounded-full">
                          {formatDate(date)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {[...projectMap.values()].flat().length} update(s)
                        </span>
                      </div>
                      <div className="space-y-5">
                        {[...projectMap.entries()].map(([projectId, entries]) => (
                          <div key={`${date}-${projectId}`} className="space-y-3">
                            <p className="text-sm font-semibold text-foreground">
                              {entries[0]?.projectName ?? "Project"}
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2">
                              {entries.map((update) => {
                                const employee = employeeById.get(update.employeeId);
                                return (
                                  <Card
                                    key={update.id}
                                    className="border-border/60 bg-card/80 shadow-sm"
                                  >
                                    <CardContent className="space-y-3 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="truncate font-semibold text-foreground">
                                            {update.employeeName}
                                          </p>
                                          <div className="mt-1 flex flex-wrap gap-1.5">
                                            {employee ? (
                                              <>
                                                <Badge variant="secondary" className="rounded-full text-[10px] font-normal">
                                                  {teamTabLabel(employee.team)}
                                                </Badge>
                                                <Badge variant="outline" className="rounded-full text-[10px] font-normal">
                                                  {employee.role}
                                                </Badge>
                                              </>
                                            ) : null}
                                          </div>
                                        </div>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                          {formatTime(update.createdAt)}
                                        </span>
                                      </div>
                                      <UpdateBlock label="Work done" value={update.workDone} />
                                      {update.blockers ? (
                                        <UpdateBlock label="Blockers" value={update.blockers} warning />
                                      ) : null}
                                      <UpdateBlock label="Tomorrow plan" value={update.tomorrowPlan} />
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/40"
    >
      {label}
      <span className="text-muted-foreground">×</span>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function UpdateBlock({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm leading-relaxed",
          warning ? "text-amber-700 dark:text-amber-300" : "text-foreground/90",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
