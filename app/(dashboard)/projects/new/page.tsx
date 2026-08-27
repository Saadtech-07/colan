"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CreateProjectForm } from "@/components/features/create-project-form";
import { PageTitle } from "@/components/ui/page-typography";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";

export default function NewProjectPage() {
  const router = useRouter();
  const { addProject, access, user, teamNames } = useAppState();
  const { withLoading } = useGlobalLoading();

  const canCreate = !!(access?.canManageProjects);

  React.useEffect(() => {
    if (access && !canCreate) {
      router.replace("/projects");
    }
  }, [access, canCreate, router]);

  if (!access) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 animate-pulse pb-24">
        <div className="space-y-3">
          <div className="h-4 w-28 rounded bg-muted/40" />
          <div className="h-8 w-48 rounded bg-muted/40" />
          <div className="h-4 w-full max-w-md rounded bg-muted/30" />
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="h-72 rounded-lg bg-muted/20" />
          <div className="h-72 rounded-lg bg-muted/20" />
        </div>
      </div>
    );
  }

  if (!canCreate) {
    return null;
  }

  const lockedTeam = access.role === "lead" ? user?.team : undefined;

  return (
    <div className="mx-auto w-full max-w-5xl pb-6">
      <header className="mb-10">
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Team Projects
        </Link>
        <PageTitle className="text-2xl sm:text-3xl">New project</PageTitle>
      </header>

      <CreateProjectForm
        teamOptions={teamNames}
        lockedTeam={lockedTeam}
        onCreate={async (input) =>
          withLoading("project-create", LOADING_PRESETS.creatingProject, () => addProject(input))
        }
      />
    </div>
  );
}
