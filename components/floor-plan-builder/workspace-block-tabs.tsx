"use client";

import { LayoutGrid, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { defaultWorkspaceBlockName } from "@/lib/floor-plan-builder/workspace-blocks";
import { useFloorPlanBuilder } from "./builder-store";

export function WorkspaceBlockTabs() {
  const {
    workspaceBlocks,
    activeBlockId,
    switchWorkspaceBlock,
    addWorkspaceBlock,
    deleteWorkspaceBlock,
  } = useFloorPlanBuilder();

  const handleAddLayout = () => {
    const suggested = defaultWorkspaceBlockName(workspaceBlocks.length);
    const name = window.prompt("Name for the new layout", suggested);
    if (name === null) return;
    addWorkspaceBlock(name.trim() || suggested);
  };

  const handleDeleteLayout = (blockId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    deleteWorkspaceBlock(blockId);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 pr-1">
        <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Layouts
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/50 bg-muted/25 p-0.5">
        {workspaceBlocks.map((block) => {
          const active = block.id === activeBlockId;
          return (
            <div
              key={block.id}
              className={cn(
                "group/tab flex items-center overflow-hidden rounded-md transition-all duration-150",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => switchWorkspaceBlock(block.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition-colors",
                  active && "text-primary",
                )}
              >
                {block.name}
              </button>
              {workspaceBlocks.length > 1 ? (
                <button
                  type="button"
                  onClick={(event) => handleDeleteLayout(block.id, event)}
                  className={cn(
                    "flex h-full items-center border-l px-1.5 opacity-0 transition-all group-hover/tab:opacity-100",
                    active
                      ? "border-border/60 hover:bg-destructive/10 hover:text-destructive"
                      : "border-transparent hover:text-destructive",
                  )}
                  aria-label={`Delete ${block.name}`}
                  title={`Delete ${block.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          onClick={handleAddLayout}
          aria-label="Add new layout"
          title="Add new empty layout"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
