"use client";

import { Plus, X } from "lucide-react";
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Layouts
        </p>
        {workspaceBlocks.map((block) => {
          const active = block.id === activeBlockId;
          return (
            <div
              key={block.id}
              className={cn(
                "flex items-center overflow-hidden rounded-md border",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/70 bg-background text-muted-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => switchWorkspaceBlock(block.id)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold transition-colors",
                  active ? "" : "hover:text-foreground",
                )}
              >
                {block.name}
              </button>
              {workspaceBlocks.length > 1 ? (
                <button
                  type="button"
                  onClick={(event) => handleDeleteLayout(block.id, event)}
                  className={cn(
                    "flex h-full items-center border-l px-1.5 transition-colors",
                    active
                      ? "border-primary-foreground/25 hover:bg-primary-foreground/15"
                      : "border-border/70 hover:bg-destructive/10 hover:text-destructive",
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
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-md"
          onClick={handleAddLayout}
          aria-label="Add new layout"
          title="Add new empty layout"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
    </div>
  );
}
