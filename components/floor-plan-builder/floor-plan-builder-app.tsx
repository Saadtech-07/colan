"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FloorPlanBuilderProvider, useFloorPlanBuilder } from "./builder-store";
import { BuilderToolbar } from "./builder-toolbar";
import { ElementToolbox, getToolHint } from "./element-toolbox";
import { FloorPlanCanvas } from "./floor-plan-canvas";
import { PropertiesPanel } from "./properties-panel";
import { WorkspaceBlockTabs } from "./workspace-block-tabs";
import { deleteFloorPlanClient, invalidateFloorPlanClientCache } from "@/lib/floor-plans-client";
import { parseApiError } from "@/providers/app-state";
import { cn } from "@/lib/utils";
import { invalidateFloorPlanLayoutCache } from "@/lib/floor-plan-layouts-client";
import type { FloorPlanLayoutState } from "@/lib/floor-plan-builder/types";
import { ensureWorkspaceBlocks, serializeWorkspaceLayout } from "@/lib/floor-plan-builder/workspace-blocks";
import { BUILDER_CHROME } from "./builder-ui";

type Props = {
  slug?: string;
  initialName: string;
  initialLayout?: FloorPlanLayoutState;
  mode: "create" | "edit";
};

function BuilderStatusBar() {
  const { layout, selection, activeBlockName, workspaceBlocks } = useFloorPlanBuilder();
  const seatCount = layout.elements.filter((el) => el.type === "seat").length;
  const pct = layout.grid.rows * layout.grid.columns > 0
    ? Math.round((seatCount / (layout.grid.rows * layout.grid.columns)) * 100)
    : 0;

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border/50 bg-[#fafbfc]/95 px-4 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm">
      <span className="font-medium">
        <span className="text-foreground/80">{activeBlockName}</span>
        {workspaceBlocks.length > 1 ? ` · ${workspaceBlocks.length} layouts` : ""}
        <span className="mx-1.5 text-border">|</span>
        Grid {layout.grid.rows} × {layout.grid.columns}
      </span>
      <span>
        <span className="font-medium text-foreground/70">{seatCount}</span> seats
        {selection.length > 0 ? (
          <>
            <span className="mx-1.5 text-border">|</span>
            <span className="font-medium text-primary">{selection.length} selected</span>
          </>
        ) : null}
        <span className="mx-1.5 text-border">|</span>
        {pct}% floor utilization
      </span>
    </div>
  );
}

function BuilderShell({ slug, initialName, mode }: Omit<Props, "initialLayout">) {
  const router = useRouter();
  const { layout, error, placementDrag, loadLayout, resetToEmptyLayout, layoutRevision, activeBlockId, fitToView } = useFloorPlanBuilder();
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

  React.useEffect(() => {
    setFloorName(initialName);
  }, [initialName]);

  const trimmedFloorName = floorName.trim();

  const buildSavePayload = React.useCallback(() => {
    const base = { ...layout, name: trimmedFloorName };
    return serializeWorkspaceLayout(base, ensureWorkspaceBlocks(base), activeBlockId);
  }, [activeBlockId, layout, trimmedFloorName]);

  const persistDraft = React.useCallback(
    async (opts?: { silent?: boolean }): Promise<string | null> => {
      if (saveInFlightRef.current) return currentSlug || null;
      if (!trimmedFloorName) {
        if (!opts?.silent) {
          setStatusIsError(true);
          setStatusMessage("Enter a floor name before saving.");
        }
        return null;
      }
      saveInFlightRef.current = true;
      if (opts?.silent) setAutoSaving(true);
      else setSaving(true);
      setStatusMessage(null);
      setStatusIsError(false);
      try {
        let targetSlug = currentSlug;
        const payload = buildSavePayload();

        if (!targetSlug) {
          const res = await fetch("/api/floor-plans/builder", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmedFloorName, layout: payload }),
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
    [buildSavePayload, currentSlug, loadLayout, router],
  );

  React.useEffect(() => {
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }
    if (!trimmedFloorName) return;
    const timer = window.setTimeout(() => {
      void persistDraft({ silent: true });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [layoutRevision, persistDraft, trimmedFloorName]);

  const publish = React.useCallback(async () => {
    setPublishing(true);
    setStatusMessage(null);
    setStatusIsError(false);
    try {
      const targetSlug = (await persistDraft()) ?? currentSlug;
      if (!targetSlug) throw new Error("Save the floor before publishing.");

      const payload = buildSavePayload();
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
  }, [buildSavePayload, currentSlug, persistDraft]);

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

  const clearCanvas = React.useCallback(() => {
    const confirmed = window.confirm(
      "Clear the active layout? Seats, rooms, and structures on this layout will be removed.",
    );
    if (!confirmed) return;
    resetToEmptyLayout();
    setStatusIsError(false);
    setStatusMessage("Active layout cleared. Drag elements from the toolbox to start fresh.");
  }, [resetToEmptyLayout]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      fitToView();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeBlockId, fitToView]);

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden", BUILDER_CHROME.shellBg)}>
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
        <ElementToolbox onBack={() => router.push("/seating/floors/new")} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fafbfc]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-[#fafbfc] px-3 py-2">
            <WorkspaceBlockTabs />
            <BuilderToolbar
              onSaveDraft={() => void persistDraft()}
              onPublish={() => void publish()}
              onDelete={() => void deleteWorkspace()}
              onClearCanvas={clearCanvas}
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
          </div>
          <p className="shrink-0 border-b border-border/40 bg-muted/20 px-4 py-1.5 text-[11px] text-muted-foreground">
            {getToolHint(placementDrag)}
            {autoSaving ? (
              <span className="text-primary/80"> · Auto-saving…</span>
            ) : currentSlug ? (
              <span className="text-emerald-700/80"> · Design saved to database</span>
            ) : trimmedFloorName ? (
              <span> · Unsaved — edits auto-save shortly</span>
            ) : (
              <span> · Enter a workspace name to start saving</span>
            )}
          </p>
          <div className={cn("relative min-h-0 flex-1", BUILDER_CHROME.canvasBg)}>
            <FloorPlanCanvas />
          </div>
          <BuilderStatusBar />
        </div>
        <aside className="flex h-full min-h-0 w-[272px] shrink-0 flex-col overflow-hidden border-l border-border/50 bg-[#fafbfc]">
          <PropertiesPanel floorName={floorName} onFloorNameChange={setFloorName} />
        </aside>
      </div>
    </div>
  );
}

export function FloorPlanBuilderApp({ slug, initialName, initialLayout, mode }: Props) {
  return (
    <div className="h-full min-h-0 w-full">
      <FloorPlanBuilderProvider initialLayout={initialLayout}>
        <BuilderShell slug={slug} initialName={initialName} mode={mode} />
      </FloorPlanBuilderProvider>
    </div>
  );
}
