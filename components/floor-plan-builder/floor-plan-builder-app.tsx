"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FloorPlanBuilderProvider, useFloorPlanBuilder } from "./builder-store";
import { BuilderToolbar } from "./builder-toolbar";
import { ElementToolbox, getToolHint } from "./element-toolbox";
import { FloorPlanCanvas } from "./floor-plan-canvas";
import { PropertiesPanel } from "./properties-panel";
import { deleteFloorPlanClient, invalidateFloorPlanClientCache } from "@/lib/floor-plans-client";
import { parseApiError } from "@/providers/app-state";
import { invalidateFloorPlanLayoutCache } from "@/lib/floor-plan-layouts-client";
import type { FloorPlanLayoutState } from "@/lib/floor-plan-builder/types";

type Props = {
  slug?: string;
  initialName: string;
  initialLayout?: FloorPlanLayoutState;
  mode: "create" | "edit";
};

function BuilderStatusBar() {
  const { layout, selection } = useFloorPlanBuilder();
  const seatCount = layout.elements.filter((el) => el.type === "seat").length;
  const pct = layout.grid.rows * layout.grid.columns > 0
    ? Math.round((seatCount / (layout.grid.rows * layout.grid.columns)) * 100)
    : 0;

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border/60 bg-card/95 px-3 py-1.5 text-[11px] text-muted-foreground">
      <span>
        Grid: {layout.grid.rows} × {layout.grid.columns}
      </span>
      <span>
        Seats: {seatCount}
        {selection.length > 0 ? ` · ${selection.length} selected` : ""}
        {" · "}
        {pct}% of floor cells
      </span>
    </div>
  );
}

function BuilderShell({ slug, initialName, mode }: Omit<Props, "initialLayout">) {
  const router = useRouter();
  const { layout, error, placementDrag, loadLayout, layoutRevision } = useFloorPlanBuilder();
  const [floorName, setFloorName] = React.useState(initialName);
  const [currentSlug, setCurrentSlug] = React.useState(slug ?? "");
  const [saving, setSaving] = React.useState(false);
  const [autoSaving, setAutoSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [statusIsError, setStatusIsError] = React.useState(false);
  const skipAutoSaveRef = React.useRef(true);
  const saveInFlightRef = React.useRef(false);

  const persistDraft = React.useCallback(
    async (opts?: { silent?: boolean }): Promise<string | null> => {
      if (saveInFlightRef.current) return currentSlug || null;
      saveInFlightRef.current = true;
      if (opts?.silent) setAutoSaving(true);
      else setSaving(true);
      setStatusMessage(null);
      setStatusIsError(false);
      try {
        let targetSlug = currentSlug;
        const payload = { ...layout, name: floorName };

        if (!targetSlug) {
          const res = await fetch("/api/floor-plans/builder", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: floorName, layout: payload }),
          });
          if (!res.ok) throw new Error(await parseApiError(res));
          const created = (await res.json()) as { slug: string };
          targetSlug = created.slug;
          setCurrentSlug(created.slug);
          loadLayout({ ...payload, floorPlanSlug: created.slug });
          router.replace(`/seating/floors/${created.slug}/builder`);
        } else {
          const res = await fetch(`/api/floor-plans/${targetSlug}/layout`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(await parseApiError(res));
        }
        invalidateFloorPlanClientCache(targetSlug);
        if (!opts?.silent) {
          setStatusIsError(false);
          setStatusMessage("Draft saved.");
        }
        return targetSlug;
      } catch (e) {
        if (!opts?.silent) {
          setStatusIsError(true);
          setStatusMessage(e instanceof Error ? e.message : "Save failed.");
        }
        return null;
      } finally {
        saveInFlightRef.current = false;
        if (opts?.silent) setAutoSaving(false);
        else setSaving(false);
      }
    },
    [currentSlug, floorName, layout, loadLayout, router],
  );

  React.useEffect(() => {
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void persistDraft({ silent: true });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [layoutRevision, floorName, persistDraft]);

  const publish = React.useCallback(async () => {
    setPublishing(true);
    setStatusMessage(null);
    setStatusIsError(false);
    try {
      const targetSlug = (await persistDraft()) ?? currentSlug;
      if (!targetSlug) throw new Error("Save the floor before publishing.");

      const payload = { ...layout, name: floorName };
      const res = await fetch(`/api/floor-plans/${targetSlug}/layout?action=publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      invalidateFloorPlanLayoutCache(targetSlug);
      invalidateFloorPlanClientCache(targetSlug);
      setStatusIsError(false);
      setStatusMessage("Floor published.");
    } catch (e) {
      setStatusIsError(true);
      setStatusMessage(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }, [currentSlug, floorName, layout, persistDraft]);

  const deleteWorkspace = React.useCallback(async () => {
    if (!currentSlug) {
      router.push("/seating/floors/new");
      return;
    }
    const confirmed = window.confirm(
      `Delete "${floorName}" and remove its saved design from the database? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setStatusMessage(null);
    setStatusIsError(false);
    try {
      await deleteFloorPlanClient(currentSlug);
      invalidateFloorPlanLayoutCache(currentSlug);
      invalidateFloorPlanClientCache();
      router.push("/seating/floors/new");
    } catch (e) {
      setStatusIsError(true);
      setStatusMessage(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }, [currentSlug, floorName, router]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <BuilderToolbar
        floorName={floorName}
        onBack={() => router.push("/seating/floors/new")}
        onSaveDraft={() => void persistDraft()}
        onPublish={() => void publish()}
        onDelete={() => void deleteWorkspace()}
        onPreview={() => {
          void (async () => {
            let slug = currentSlug;
            if (!slug) {
              slug = (await persistDraft()) ?? "";
            }
            if (slug) {
              router.push(`/seating?office=${encodeURIComponent(slug)}`);
              return;
            }
            setStatusIsError(true);
            setStatusMessage("Save the floor before previewing.");
          })();
        }}
        saving={saving}
        autoSaving={autoSaving}
        publishing={publishing}
        deleting={deleting}
        canDelete
      />

      {(error || statusMessage) && (
        <div
          className={
            error || statusIsError
              ? "shrink-0 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
              : "shrink-0 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-800"
          }
        >
          {error ?? statusMessage}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ElementToolbox />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <p className="shrink-0 border-b border-border/40 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
            {getToolHint(placementDrag?.type ?? null, placementDrag?.quantity ?? 1)}
            {autoSaving ? " · Auto-saving…" : currentSlug ? " · Design saved to database" : " · Unsaved — edits auto-save shortly"}
          </p>
          <FloorPlanCanvas />
          <BuilderStatusBar />
        </div>
        <PropertiesPanel floorName={floorName} onFloorNameChange={setFloorName} showFloorName={mode === "create" && !currentSlug} />
      </div>
    </div>
  );
}

export function FloorPlanBuilderApp({ slug, initialName, initialLayout, mode }: Props) {
  return (
    <FloorPlanBuilderProvider initialLayout={initialLayout}>
      <BuilderShell slug={slug} initialName={initialName} mode={mode} />
    </FloorPlanBuilderProvider>
  );
}
