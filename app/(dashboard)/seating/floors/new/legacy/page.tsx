"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FloorBranchEditor } from "@/components/seating/floor-branch-editor";
import { PageTitle } from "@/components/ui/page-typography";
import {
  buildBranchPayloads,
  defaultBranchEditorState,
  type BranchEditorState,
} from "@/lib/floor-plan-editor-payload";
import {
  createFloorPlanClient,
  invalidateFloorPlanClientCache,
} from "@/lib/floor-plans-client";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";

export default function LegacyNewFloorPlanPage() {
  const router = useRouter();
  const { access } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();
  const canAssign = access?.canAssignSeating ?? false;
  const busy = isLoadingKey("floor-plan-create");
  const [error, setError] = React.useState<string | null>(null);
  const initial = React.useMemo(() => defaultBranchEditorState(), []);

  React.useEffect(() => {
    if (access && !canAssign) {
      router.replace("/seating");
    }
  }, [access, canAssign, router]);

  if (!access) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-6 pb-16">
        <div className="h-8 w-48 rounded bg-muted/40" />
        <div className="h-64 rounded-2xl bg-muted/20" />
      </div>
    );
  }

  if (!canAssign) return null;

  const handleSubmit = async (state: BranchEditorState) => {
    setError(null);
    await withLoading("floor-plan-create", LOADING_PRESETS.creatingFloorPlan, async () => {
      try {
        const payloads = buildBranchPayloads(state);
        let firstSlug = "";
        for (const payload of payloads) {
          const created = await createFloorPlanClient(payload);
          if (!firstSlug) firstSlug = created.slug;
        }
        invalidateFloorPlanClientCache();
        router.push(`/seating?office=${encodeURIComponent(firstSlug)}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not create floor plan.";
        setError(message);
        throw e;
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl pb-16">
      <header className="mb-8">
        <Link
          href="/seating/floors/new"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Create floor
        </Link>
        <PageTitle className="text-2xl sm:text-3xl">Legacy floor wizard</PageTitle>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Form-based row and cabin configuration. Prefer the Floor Plan Builder for new layouts.
        </p>
      </header>

      <FloorBranchEditor
        mode="create"
        initial={initial}
        busy={busy}
        error={error}
        submitLabel="Create branch"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
