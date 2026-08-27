"use client";

import * as React from "react";
import {
  ChevronDown,
  LayoutGrid,
  Loader2,
  Plus,
  Rows3,
  SquareStack,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type BlockDraft,
  type BranchEditorState,
  type CabinDraft,
  type CabinSide,
  countBlockSeats,
  createEmptyBlock,
  isPrimaryBlock,
  newDraftId,
  nextBlockLabel,
} from "@/lib/floor-plan-editor-payload";
import { cn } from "@/lib/utils";

const SIDE_OPTIONS: Array<{ value: CabinSide; label: string; hint: string }> = [
  { value: "top", label: "Top", hint: "Above first seating row" },
  { value: "bottom", label: "Bottom", hint: "Below last seating row" },
  { value: "left", label: "Left", hint: "Side column (slot 1)" },
  { value: "right", label: "Right", hint: "Side column (slot 2)" },
];

type Props = {
  mode: "create" | "edit";
  initial: BranchEditorState;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (state: BranchEditorState) => void | Promise<void>;
  footer?: React.ReactNode;
};

export function FloorBranchEditor({
  mode,
  initial,
  busy = false,
  error = null,
  submitLabel,
  onSubmit,
  footer,
}: Props) {
  const [state, setState] = React.useState<BranchEditorState>(initial);
  const [addSide, setAddSide] = React.useState<CabinSide>("top");
  const [addCount, setAddCount] = React.useState("2");
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setState(initial);
    setLocalError(null);
  }, [initial]);

  const activeBlock =
    state.blocks.find((b) => b.id === state.activeBlockId) ?? state.blocks[0] ?? null;
  const activeIsPrimary = activeBlock
    ? isPrimaryBlock(activeBlock, state.blocks)
    : true;

  const updateActiveBlock = (patch: Partial<BlockDraft>) => {
    if (!activeBlock) return;
    setState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === activeBlock.id ? { ...b, ...patch } : b)),
    }));
  };

  const setActiveBlockId = (id: string) => {
    setState((prev) => ({ ...prev, activeBlockId: id }));
  };

  const addBlock = () => {
    const label = nextBlockLabel(state.blocks);
    const block = createEmptyBlock(label);
    setState((prev) => ({
      ...prev,
      blocks: [...prev.blocks, block],
      activeBlockId: block.id,
    }));
  };

  const removeActiveBlock = () => {
    if (!activeBlock || activeIsPrimary) return;
    const confirmed = window.confirm(
      `Remove ${activeBlock.label}?\n\nIts seating layout will not be saved with this branch.`,
    );
    if (!confirmed) return;
    setState((prev) => {
      const blocks = prev.blocks.filter((b) => b.id !== activeBlock.id);
      return {
        ...prev,
        blocks,
        activeBlockId: blocks[0]?.id ?? "",
      };
    });
  };

  const addCabins = () => {
    if (!activeBlock) return;
    const count = Math.min(8, Math.max(1, Number(addCount) || 1));
    const next: CabinDraft[] = [];
    for (let i = 0; i < count; i += 1) {
      next.push({ id: newDraftId(), label: "", side: addSide });
    }
    updateActiveBlock({ cabins: [...activeBlock.cabins, ...next] });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setLocalError(null);
    try {
      await onSubmit(state);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Save failed.");
    }
  };

  const displayError = localError || error;
  const seatTotal = activeBlock ? countBlockSeats(activeBlock) : 0;
  const cabinCount = activeBlock?.cabins.filter((c) => c.label.trim()).length ?? 0;
  const branchTitle = state.city.trim() || "New branch";
  const showBlockSwitcher = state.blocks.length > 1;

  return (
    <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
      <section className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="branch-city">City / branch</Label>
            <Input
              id="branch-city"
              value={state.city}
              onChange={(e) => setState((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="Hyderabad"
              disabled={busy}
              className="h-11 max-w-lg rounded-xl text-base font-semibold"
              required
            />
            <p className="text-xs text-muted-foreground">
              Every branch starts with <strong>Block A</strong> (like Chennai & Bangalore). Add
              Block B only if you need a second layout.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 gap-1.5 rounded-xl"
            disabled={busy}
            onClick={addBlock}
          >
            <Plus className="h-3.5 w-3.5" />
            {state.blocks.length === 1 ? "Add Block B" : "Add block"}
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {branchTitle}
          </h2>

          {showBlockSwitcher ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={busy}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl border-border/70 bg-background px-3 text-sm font-semibold shadow-sm"
                >
                  {activeBlock?.label ?? "Block A"}
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[11rem]">
                {state.blocks.map((block) => (
                  <DropdownMenuItem
                    key={block.id}
                    className={cn(
                      "cursor-pointer rounded-lg text-sm font-medium",
                      block.id === activeBlock?.id && "bg-accent",
                    )}
                    onClick={() => setActiveBlockId(block.id)}
                  >
                    {block.label}
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                      {countBlockSeats(block)} bays
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="inline-flex h-9 items-center rounded-xl border border-border/70 bg-muted/40 px-3 text-sm font-semibold">
              Block A
            </span>
          )}

          {!activeIsPrimary ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-9 gap-1.5 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={busy}
              onClick={removeActiveBlock}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove {activeBlock?.label}
            </Button>
          ) : null}
        </div>

        <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
          {showBlockSwitcher
            ? "Switch blocks to design seating bays and cabins for each layout separately."
            : "Design seating for Block A. Use “Add Block B” when you need another floor plan under this city."}
        </p>
      </section>

      {activeBlock ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={LayoutGrid} label="Total bays" value={String(seatTotal)} tone="slate" />
          <StatCard
            icon={Rows3}
            label="Seating rows"
            value={String(activeBlock.rows.length)}
            tone="emerald"
          />
          <StatCard icon={SquareStack} label="Cabins" value={String(cabinCount)} tone="amber" />
        </div>
      ) : null}

      {activeBlock ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 shadow-sm dark:border-border dark:bg-muted/30 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-0.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-muted-foreground">
                Designing
              </p>
              <h3 className="mt-0.5 text-base font-semibold text-foreground">
                {activeBlock.label}
              </h3>
            </div>
            {mode === "edit" && activeBlock.existingSlug ? (
              <p className="text-xs text-muted-foreground">
                slug · <code className="text-[11px]">{activeBlock.existingSlug}</code>
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">Seating bays</h4>
                <p className="text-xs text-muted-foreground">
                  Key <code className="text-[11px]">A</code> + seats{" "}
                  <code className="text-[11px]">16</code> → A1…A16
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 rounded-lg"
                disabled={busy}
                onClick={() => {
                  const nextLetter = String.fromCharCode(
                    65 + Math.min(activeBlock.rows.length, 25),
                  );
                  updateActiveBlock({
                    rows: [
                      ...activeBlock.rows,
                      {
                        id: newDraftId(),
                        key: nextLetter,
                        label: `${nextLetter}-ROW`,
                        seatCount: "16",
                      },
                    ],
                  });
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add row
              </Button>
            </div>

            <div className="space-y-2">
              {activeBlock.rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 p-2.5 sm:grid-cols-[5rem_minmax(0,1fr)_5.5rem_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Key</Label>
                    <Input
                      value={row.key}
                      placeholder="A"
                      disabled={busy}
                      required
                      onChange={(e) =>
                        updateActiveBlock({
                          rows: activeBlock.rows.map((r) =>
                            r.id === row.id ? { ...r, key: e.target.value } : r,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Label</Label>
                    <Input
                      value={row.label}
                      placeholder="A-ROW"
                      disabled={busy}
                      onChange={(e) =>
                        updateActiveBlock({
                          rows: activeBlock.rows.map((r) =>
                            r.id === row.id ? { ...r, label: e.target.value } : r,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Seats</Label>
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={row.seatCount}
                      placeholder="16"
                      disabled={busy}
                      required
                      onChange={(e) =>
                        updateActiveBlock({
                          rows: activeBlock.rows.map((r) =>
                            r.id === row.id ? { ...r, seatCount: e.target.value } : r,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={busy || activeBlock.rows.length <= 1}
                      onClick={() =>
                        updateActiveBlock({
                          rows: activeBlock.rows.filter((r) => r.id !== row.id),
                        })
                      }
                      aria-label="Delete row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-3.5 sm:p-4">
            <div>
              <h4 className="text-sm font-semibold">Cabins</h4>
              <p className="text-xs text-muted-foreground">
                Choose Top / Bottom / Left / Right and how many to add. Side column max 2.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label className="text-xs text-muted-foreground">Position</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SIDE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={busy}
                      title={opt.hint}
                      onClick={() => setAddSide(opt.value)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                        addSide === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-24 space-y-1">
                <Label htmlFor="cabin-count" className="text-xs text-muted-foreground">
                  Count
                </Label>
                <Input
                  id="cabin-count"
                  type="number"
                  min={1}
                  max={8}
                  value={addCount}
                  disabled={busy}
                  onChange={(e) => setAddCount(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 gap-1.5 rounded-lg"
                disabled={busy}
                onClick={addCabins}
              >
                <Plus className="h-3.5 w-3.5" />
                Add cabins
              </Button>
            </div>

            {activeBlock.cabins.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cabins on {activeBlock.label} yet. Select Top, count 2, then name them.
              </p>
            ) : (
              <div className="space-y-2">
                {activeBlock.cabins.map((cabin) => (
                  <div
                    key={cabin.id}
                    className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 p-2.5"
                  >
                    <div className="w-full space-y-1 sm:w-36">
                      <Label className="text-xs text-muted-foreground">Side</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                        value={cabin.side}
                        disabled={busy}
                        onChange={(e) =>
                          updateActiveBlock({
                            cabins: activeBlock.cabins.map((c) =>
                              c.id === cabin.id
                                ? { ...c, side: e.target.value as CabinSide }
                                : c,
                            ),
                          })
                        }
                      >
                        {SIDE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[10rem] flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Cabin name</Label>
                      <Input
                        value={cabin.label}
                        placeholder="Manager"
                        disabled={busy}
                        onChange={(e) =>
                          updateActiveBlock({
                            cabins: activeBlock.cabins.map((c) =>
                              c.id === cabin.id ? { ...c, label: e.target.value } : c,
                            ),
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={busy}
                      onClick={() =>
                        updateActiveBlock({
                          cabins: activeBlock.cabins.filter((c) => c.id !== cabin.id),
                        })
                      }
                      aria-label="Remove cabin"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {displayError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {displayError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button type="submit" disabled={busy || !activeBlock} className="min-w-[11rem] gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>

      {footer}
    </form>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "slate" | "emerald" | "amber";
}) {
  const tones = {
    slate: "from-slate-500/12 via-slate-500/6 to-transparent text-slate-600",
    emerald: "from-emerald-500/12 via-emerald-500/6 to-transparent text-emerald-700",
    amber: "from-amber-500/12 via-amber-500/6 to-transparent text-amber-700",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm",
        tones[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
    </div>
  );
}
