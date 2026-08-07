"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { FloorBranchEditor } from "@/components/seating/floor-branch-editor";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-typography";
import {
  branchKeyForPlan,
  groupFloorPlansByBranch,
} from "@/lib/floor-plan-branch";
import {
  branchStateFromPlans,
  buildBlockPayload,
  defaultBranchEditorState,
  type BranchEditorState,
} from "@/lib/floor-plan-editor-payload";
import {
  createFloorPlanClient,
  deleteFloorPlanClient,
  fetchFloorPlanDetail,
  fetchFloorPlanSummaries,
  invalidateFloorPlanClientCache,
  updateFloorPlanClient,
} from "@/lib/floor-plans-client";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import type { FloorPlanDTO } from "@/models/floor-plan.model";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";

export default function EditFloorPlanPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug ?? "").trim().toLowerCase();
  const router = useRouter();
  const { access } = useAppState();
  const { withLoading, isLoadingKey } = useGlobalLoading();
  const canAssign = access?.canAssignSeating ?? false;

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [initial, setInitial] = React.useState<BranchEditorState>(defaultBranchEditorState());
  const [branchLabel, setBranchLabel] = React.useState("Branch");
  const [knownSlugs, setKnownSlugs] = React.useState<string[]>([]);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const saving = isLoadingKey("floor-plan-update");
  const deleting = isLoadingKey("floor-plan-delete");
  const busy = saving || deleting;

  React.useEffect(() => {
    if (access && !canAssign) {
      router.replace("/seating");
    }
  }, [access, canAssign, router]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) {
        setLoadError("Missing floor plan slug.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const [plan, summaries] = await Promise.all([
          fetchFloorPlanDetail(slug, { force: true }),
          fetchFloorPlanSummaries({ force: true }),
        ]);
        if (cancelled) return;
        if (!plan) {
          setLoadError("Floor plan not found.");
          setLoading(false);
          return;
        }

        const branchKey = branchKeyForPlan(plan);
        setBranchLabel(branchKey);
        const group = groupFloorPlansByBranch(summaries).find((g) => g.key === branchKey);
        const siblingSummaries = group?.plans ?? [{ ...plan, seatCount: plan.seatIds.length }];

        const details: FloorPlanDTO[] = [];
        for (const summary of siblingSummaries) {
          const detail =
            summary.slug === plan.slug
              ? plan
              : await fetchFloorPlanDetail(summary.slug, { force: true });
          if (detail) {
            details.push(detail);
          }
        }

        if (cancelled) return;
        const state = branchStateFromPlans(branchKey, details);
        const active = state.blocks.find((b) => b.existingSlug === slug);
        setInitial({
          ...state,
          activeBlockId: active?.id ?? state.activeBlockId,
        });
        setKnownSlugs(details.map((d) => d.slug));
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load floor plan.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

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
    setSaveError(null);
    await withLoading("floor-plan-update", LOADING_PRESETS.updatingFloorPlan, async () => {
      try {
        const keptSlugs = new Set<string>();
        let focusSlug = slug;

        for (let index = 0; index < state.blocks.length; index += 1) {
          const block = state.blocks[index]!;
          const payload = buildBlockPayload(state.city, block, index);
          if (block.existingSlug) {
            const { slug: _omit, ...patch } = payload;
            await updateFloorPlanClient(block.existingSlug, patch);
            keptSlugs.add(block.existingSlug);
            if (block.existingSlug === slug) focusSlug = block.existingSlug;
          } else {
            const created = await createFloorPlanClient(payload);
            keptSlugs.add(created.slug);
            focusSlug = created.slug;
          }
        }

        for (const oldSlug of knownSlugs) {
          if (!keptSlugs.has(oldSlug)) {
            await deleteFloorPlanClient(oldSlug);
          }
        }

        invalidateFloorPlanClientCache();
        router.push(`/seating?office=${encodeURIComponent(focusSlug)}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not save floor plan.";
        setSaveError(message);
        throw e;
      }
    });
  };

  const deleteEntireBranch = async () => {
    const targets = knownSlugs.length > 0 ? knownSlugs : [slug];
    const confirmed = window.confirm(
      targets.length > 1
        ? `Delete entire "${branchLabel}" branch?\n\nThis permanently removes ${targets.length} floor plans:\n${targets.join(", ")}\n\nThis cannot be undone.`
        : `Delete entire "${branchLabel}" branch?\n\nThis permanently removes the floor plan. This cannot be undone.`,
    );
    if (!confirmed) return;

    await withLoading("floor-plan-delete", LOADING_PRESETS.deletingFloorPlan, async () => {
      try {
        for (const target of targets) {
          await deleteFloorPlanClient(target);
        }
        invalidateFloorPlanClientCache();
        router.push("/seating");
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Could not delete branch.");
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl pb-16">
      <header className="mb-8">
        <Link
          href={`/seating?office=${encodeURIComponent(slug)}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Seating arrangement
        </Link>
        <PageTitle className="text-2xl sm:text-3xl">Edit floor</PageTitle>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Update Block A for{" "}
          <span className="font-medium text-foreground">{branchLabel}</span>. Add or switch to
          Block B when this city has more than one layout.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/20 px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading branch…
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">
          {loadError}
        </div>
      ) : (
        <FloorBranchEditor
          mode="edit"
          initial={initial}
          busy={busy}
          error={saveError}
          submitLabel="Save branch"
          onSubmit={handleSubmit}
          footer={
            <section className="mt-10 space-y-3 rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Permanently remove every block in this branch from MongoDB.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                className="h-10 gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void deleteEntireBranch()}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete entire {branchLabel}
              </Button>
            </section>
          }
        />
      )}
    </div>
  );
}
