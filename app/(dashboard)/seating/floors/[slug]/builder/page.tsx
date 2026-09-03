"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { FloorPlanBuilderApp } from "@/components/floor-plan-builder/floor-plan-builder-app";
import { createEmptyLayout } from "@/lib/floor-plan-builder/layout-engine";
import type { FloorPlanLayoutState } from "@/lib/floor-plan-builder/types";
import { fetchFloorPlanDetail } from "@/lib/floor-plans-client";
import { useAppState } from "@/providers/app-state";

export default function EditFloorBuilderPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { access } = useAppState();
  const canAssign = access?.canAssignSeating ?? false;
  const [layout, setLayout] = React.useState<FloorPlanLayoutState | null>(null);
  const [name, setName] = React.useState("Floor");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (access && !canAssign) router.replace("/seating");
  }, [access, canAssign, router]);

  React.useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [plan, layoutRes] = await Promise.all([
          fetchFloorPlanDetail(slug),
          fetch(`/api/floor-plans/${slug}/layout`, { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (!plan) {
          setLayout(createEmptyLayout("Floor"));
          return;
        }
        setName(plan.name);

        if (layoutRes.ok) {
          const saved = (await layoutRes.json()) as FloorPlanLayoutState & { elements: FloorPlanLayoutState["elements"] };
          setLayout({
            name: saved.name ?? plan.name,
            status: "draft",
            version: saved.version ?? 0,
            grid: saved.grid ?? createEmptyLayout(plan.name).grid,
            elements: saved.elements ?? [],
            blocks: saved.blocks,
            floorPlanSlug: slug,
          });
        } else {
          setLayout(createEmptyLayout(plan.name));
        }
      } catch {
        if (!cancelled) setLayout(createEmptyLayout("Floor"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!access || loading || !layout) {
    return <div className="flex h-dvh w-full items-center justify-center bg-muted/30 animate-pulse" />;
  }
  if (!canAssign) return null;

  return (
    <FloorPlanBuilderApp slug={slug} mode="edit" initialName={name} initialLayout={layout} />
  );
}
