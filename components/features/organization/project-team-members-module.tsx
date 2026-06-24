"use client";

import * as React from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CheckSquare,
  Loader2,
  MapPin,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTitle, sectionDescriptionClassName } from "@/components/ui/page-typography";
import { employeeSlugFromId } from "@/lib/employee-slug";
import { profileNameInitial } from "@/lib/profile-image";
import { cn } from "@/lib/utils";
import { parseApiError, useAppState } from "@/providers/app-state";

type ProjectMemberRow = {
  id: string;
  name: string;
  employeeId: string;
  imageUrl: string;
  designation: string;
  department: string;
  assignedProject: { id: string; name: string; slug: string };
  teamLeadName?: string;
  seatLocation: string;
  currentTasks: Array<{ id: string; title: string; status: string }>;
  taskTotal: number;
  completionPercentage: number;
};

export function ProjectTeamMembersModule() {
  const { projects } = useAppState();
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [members, setMembers] = React.useState<ProjectMemberRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedProject = projects.find((project) => project.id === projectId) ?? projects[0];

  React.useEffect(() => {
    if (!selectedProject && projects[0]) {
      setProjectId(projects[0].id);
    }
  }, [projects, selectedProject]);

  const loadMembers = React.useCallback(async () => {
    if (!selectedProject) {
      setMembers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${selectedProject.slug}/members`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setMembers((await res.json()) as ProjectMemberRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project team");
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  React.useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageTitle>Team Members</PageTitle>
          <p className={cn("mt-1", sectionDescriptionClassName)}>
            Project-specific team management with tasks, seating, and quick actions.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Select value={selectedProject?.id ?? ""} onValueChange={setProjectId}>
            <SelectTrigger>
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
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading project team...
        </div>
      ) : !selectedProject ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 py-16 text-center">
          <BriefcaseBusiness className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium">Select a project to view its team.</p>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 py-16 text-center">
          <p className="font-medium">No members assigned to {selectedProject.name} yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {members.map((member) => (
            <Card key={member.id} className="border-border/60 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.imageUrl} alt={member.name} />
                    <AvatarFallback>{profileNameInitial(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.employeeId}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {member.designation} · {member.department}
                    </p>
                  </div>
                  <Badge variant="secondary">{member.completionPercentage}%</Badge>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    {member.assignedProject.name}
                  </p>
                  <p className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5" />
                    Team lead: {member.teamLeadName ?? "—"}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Seat {member.seatLocation}
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckSquare className="h-3.5 w-3.5" />
                    {member.taskTotal} task(s) on this project
                  </p>
                </div>

                {member.currentTasks.length > 0 ? (
                  <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Current tasks
                    </p>
                    <ul className="space-y-1 text-sm">
                      {member.currentTasks.map((task) => (
                        <li key={task.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">{task.title}</span>
                          <Badge variant="outline">{task.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/team-members/${employeeSlugFromId(member.employeeId)}`}>
                      View profile
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/chat">
                      <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                      Message
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/projects/tasks">Assign task</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
