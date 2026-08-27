"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CreateTeamSheet } from "@/components/features/create-team-sheet";
import { EditTeamSheet } from "@/components/features/edit-team-sheet";
import { useAppState } from "@/providers/app-state";

const EDIT_TEAM_PATH = /^\/projects\/teams\/([^/]+)\/edit$/;

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, access, workspaceTeams, refreshData } = useAppState();
  const isCreateTeamRoute = pathname === "/projects/teams/new";
  const editTeamId = pathname.match(EDIT_TEAM_PATH)?.[1] ?? null;
  const teamToEdit = editTeamId
    ? workspaceTeams.find((team) => team.id === editTeamId) ?? null
    : null;

  React.useEffect(() => {
    if (!access) return;
    if ((isCreateTeamRoute || editTeamId) && !isAdmin) {
      router.replace("/projects");
    }
  }, [access, editTeamId, isAdmin, isCreateTeamRoute, router]);

  React.useEffect(() => {
    if (!editTeamId || workspaceTeams.length === 0) return;
    if (!teamToEdit) {
      router.replace("/projects");
    }
  }, [editTeamId, router, teamToEdit, workspaceTeams.length]);

  const closeTeamPanel = React.useCallback(() => {
    router.push("/projects");
  }, [router]);

  const handleCreateOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && isCreateTeamRoute) closeTeamPanel();
    },
    [closeTeamPanel, isCreateTeamRoute],
  );

  const handleEditOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && editTeamId) closeTeamPanel();
    },
    [closeTeamPanel, editTeamId],
  );

  return (
    <>
      {children}
      {isAdmin ? (
        <>
          <CreateTeamSheet open={isCreateTeamRoute} onOpenChange={handleCreateOpenChange} />
          {teamToEdit ? (
            <EditTeamSheet
              team={teamToEdit}
              open={!!editTeamId}
              onOpenChange={handleEditOpenChange}
              onUpdated={refreshData}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
