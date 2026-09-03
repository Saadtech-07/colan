"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { FloorPlanBuilderApp } from "@/components/floor-plan-builder/floor-plan-builder-app";
import { createEmptyLayout } from "@/lib/floor-plan-builder/layout-engine";
import type { FloorPlanLayoutState } from "@/lib/floor-plan-builder/types";
import {
  fetchFloorPlanEditLayout,
  floorPlanLayoutDtoToState,
} from "@/lib/floor-plan-layouts-client";
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
        const [plan, saved] = await Promise.all([
          fetchFloorPlanDetail(slug, { force: true }),
          fetchFloorPlanEditLayout(slug, { force: true }),
        ]);
        if (cancelled) return;
        if (!plan) {
          setLayout(createEmptyLayout("Floor"));
          return;
        }
        setName(plan.name);

        if (saved) {
          setLayout(floorPlanLayoutDtoToState(saved, slug));
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
    <FloorPlanBuilderApp
      key={`${slug}-${layout.version}-${layout.elements.length}`}
      slug={slug}
      mode="edit"
      initialName={name}
      initialLayout={layout}
    />
  );
}
