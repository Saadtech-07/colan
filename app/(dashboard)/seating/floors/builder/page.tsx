"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FloorPlanBuilderApp } from "@/components/floor-plan-builder/floor-plan-builder-app";
import { createEmptyLayout } from "@/lib/floor-plan-builder/layout-engine";
import { useAppState } from "@/providers/app-state";

export default function NewFloorBuilderPage() {
  const router = useRouter();
  const { access } = useAppState();
  const canAssign = access?.canAssignSeating ?? false;

  React.useEffect(() => {
    if (access && !canAssign) router.replace("/seating");
  }, [access, canAssign, router]);

  if (!access) {
    return <div className="flex h-dvh w-full items-center justify-center bg-muted/30 animate-pulse" />;
  }
  if (!canAssign) return null;

  return (
    <FloorPlanBuilderApp
      mode="create"
      initialName=""
      initialLayout={createEmptyLayout()}
    />
  );
}
