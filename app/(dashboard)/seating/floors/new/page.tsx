"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutGrid, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-typography";
import {
  deleteFloorPlanClient,
  fetchFloorPlanSummaries,
  invalidateFloorPlanClientCache,
} from "@/lib/floor-plans-client";
import { invalidateFloorPlanLayoutCache } from "@/lib/floor-plan-layouts-client";
import type { FloorPlanSummary } from "@/models/floor-plan.model";
import { useAppState } from "@/providers/app-state";

function formatSavedAt(iso?: string) {
  if (!iso) return "Not saved yet";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function NewFloorPlanPage() {
  const router = useRouter();
  const { access } = useAppState();
  const canAssign = access?.canAssignSeating ?? false;
  const [designs, setDesigns] = React.useState<FloorPlanSummary[]>([]);
  const [loadingDesigns, setLoadingDesigns] = React.useState(true);
  const [deletingSlug, setDeletingSlug] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (access && !canAssign) {
      router.replace("/seating");
    }
  }, [access, canAssign, router]);

  React.useEffect(() => {
    if (!canAssign) return;
    let cancelled = false;
    (async () => {
      setLoadingDesigns(true);
      try {
        const plans = await fetchFloorPlanSummaries({ force: true });
        if (!cancelled) {
          setDesigns(plans.filter((p) => p.migrationStatus === "builder"));
        }
      } finally {
        if (!cancelled) setLoadingDesigns(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssign]);

  const handleDelete = async (plan: FloorPlanSummary) => {
    const confirmed = window.confirm(
      `Delete "${plan.name}" and remove its saved design from the database?`,
    );
    if (!confirmed) return;

    setDeletingSlug(plan.slug);
    try {
      await deleteFloorPlanClient(plan.slug);
      invalidateFloorPlanLayoutCache(plan.slug);
      invalidateFloorPlanClientCache();
      setDesigns((prev) => prev.filter((p) => p.slug !== plan.slug));
    } finally {
      setDeletingSlug(null);
    }
  };

  if (!access) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-6 pb-16">
        <div className="h-8 w-48 rounded bg-muted/40" />
        <div className="h-64 rounded-2xl bg-muted/20" />
      </div>
    );
  }

  if (!canAssign) return null;

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <header className="mb-8">
        <Link
          href="/seating"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Seating arrangement
        </Link>
        <PageTitle className="text-2xl sm:text-3xl">Create floor</PageTitle>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Use the visual Floor Plan Builder to design seating bays, cabins, meeting rooms, pillars,
          and entrances on a grid canvas. Saved designs are stored in the database and can be edited
          or deleted here.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Button
          type="button"
          className="h-auto flex-col items-start gap-3 rounded-2xl px-5 py-5 text-left"
          onClick={() => router.push("/seating/floors/builder")}
        >
          <Sparkles className="h-6 w-6" />
          <span>
            <span className="block text-base font-semibold">New Floor Plan Builder</span>
            <span className="mt-1 block text-sm font-normal opacity-90">
              Start with a blank canvas — add seats, cabins, and rooms as you need them.
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-auto flex-col items-start gap-3 rounded-2xl px-5 py-5 text-left"
          onClick={() => router.push("/seating/floors/new/legacy")}
        >
          <LayoutGrid className="h-6 w-6" />
          <span>
            <span className="block text-base font-semibold">Legacy form wizard</span>
            <span className="mt-1 block text-sm font-normal text-muted-foreground">
              Row and cabin counts via forms (deprecated).
            </span>
          </span>
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Saved workspace designs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Builder floors saved to the database (`floor_plan_layouts`). Refresh or return later to
          continue editing.
        </p>

        {loadingDesigns ? (
          <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted/30" />
        ) : designs.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
            No saved builder designs yet. Create one above — it will appear here after the first
            auto-save.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {designs.map((plan) => (
              <li
                key={plan.slug}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.seatCount} seats · Last saved {formatSavedAt(plan.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5"
                    onClick={() => router.push(`/seating/floors/${encodeURIComponent(plan.slug)}/builder`)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 text-destructive hover:text-destructive"
                    disabled={deletingSlug === plan.slug}
                    onClick={() => void handleDelete(plan)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingSlug === plan.slug ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
