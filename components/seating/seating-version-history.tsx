"use client";

import * as React from "react";
import { Clock3, Eye, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchSeatingVersion, fetchSeatingVersions } from "@/lib/seating-versions-client";
import { cn } from "@/lib/utils";
import type { SeatingVersionDTO, SeatingVersionSummary } from "@/models/seating-version.model";

type Props = {
  open: boolean;
  officeSlug: string;
  officeLabel?: string;
  selectedVersionId?: string | null;
  onOpenChange: (open: boolean) => void;
  onViewVersion: (version: SeatingVersionDTO) => void;
  elevated?: boolean;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SeatingVersionHistory({
  open,
  officeSlug,
  officeLabel,
  selectedVersionId,
  onOpenChange,
  onViewVersion,
  elevated = false,
}: Props) {
  const [versions, setVersions] = React.useState<SeatingVersionSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [openingId, setOpeningId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSeatingVersions(officeSlug)
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load versions.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [officeSlug, open]);

  const viewVersion = async (id: string) => {
    setOpeningId(id);
    setError(null);
    try {
      const version = await fetchSeatingVersion(id);
      onViewVersion(version);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open version.");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        overlayClassName={elevated ? "z-[110]" : undefined}
        className={cn(elevated && "z-[120]")}
      >
        <SheetHeader className="border-b border-border/60 px-6 py-5 pr-12">
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Previous saved layouts{officeLabel ? ` for ${officeLabel}` : ""}. Open a
            version to view the seating as it was saved.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-4">
          {loading ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">
              Loading versions…
            </p>
          ) : error ? (
            <p className="px-2 py-8 text-center text-sm text-destructive">{error}</p>
          ) : versions.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">
              No saved versions yet. Save Changes to create the first snapshot.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {versions.map((version) => {
                const selected = selectedVersionId === version.id;
                return (
                  <li
                    key={version.id}
                    className={cn(
                      "rounded-2xl border px-3 py-3",
                      selected
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/70 bg-muted/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          Version {version.version}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Clock3 className="h-3 w-3 shrink-0" />
                          {formatWhen(version.createdAt)}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <UserRound className="h-3 w-3 shrink-0" />
                          <span className="truncate">{version.createdBy.name}</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={selected ? "secondary" : "outline"}
                        size="sm"
                        className="h-8 shrink-0 gap-1 rounded-xl px-2.5 text-xs"
                        disabled={openingId === version.id}
                        onClick={() => void viewVersion(version.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {selected ? "Viewing" : "View"}
                      </Button>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {version.changes.slice(0, 4).map((change) => (
                        <li
                          key={change.id}
                          className="text-xs leading-5 text-muted-foreground"
                        >
                          {change.summary}
                        </li>
                      ))}
                      {version.changes.length > 4 ? (
                        <li className="text-xs text-muted-foreground">
                          +{version.changes.length - 4} more
                        </li>
                      ) : null}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
