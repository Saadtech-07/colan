"use client";

import * as React from "react";
import { CheckCircle2, Loader2, UserX2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { teamTabLabel } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import type { DailyUpdateAttendance } from "@/lib/daily-updates-attendance";

type DailyUpdateAttendancePanelProps = {
  date: string;
  search: string;
  className?: string;
  onSelectEmployee?: (employeeName: string) => void;
  selectedEmployee?: string;
};

export function DailyUpdateAttendancePanel({
  date,
  search,
  className,
  onSelectEmployee,
  selectedEmployee,
}: DailyUpdateAttendancePanelProps) {
  const [attendance, setAttendance] = React.useState<DailyUpdateAttendance | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!date) {
      setAttendance(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ date });
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(`/api/daily-updates/attendance?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          const message =
            res.status === 403
              ? "You do not have permission to view daily update attendance."
              : ((await res.json().catch(() => null)) as { error?: string } | null)?.error ??
                "Failed to load attendance";
          throw new Error(message);
        }
        setAttendance((await res.json()) as DailyUpdateAttendance);
      } catch (e) {
        if (controller.signal.aborted) return;
        setAttendance(null);
        setError(e instanceof Error ? e.message : "Failed to load attendance");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [date, search]);

  if (!date) return null;

  return (
    <Card className={cn("border-border/70 bg-background/75 shadow-sm backdrop-blur-xl", className)}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Daily update check</p>
            <p className="text-xs text-muted-foreground">{formatAttendanceDate(date)}</p>
          </div>
          {attendance ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">
                {attendance.submitted.length} submitted
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full",
                  attendance.missing.length > 0 && "border-amber-500/40 text-amber-700 dark:text-amber-300",
                )}
              >
                {attendance.missing.length} missing
              </Badge>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking who submitted updates…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : attendance ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <AttendanceList
              title="Submitted"
              icon={CheckCircle2}
              tone="success"
              rows={attendance.submitted.map((row) => ({
                id: row.employeeId,
                name: row.employeeName,
                meta: `${teamTabLabel(row.team as import("@/types").TeamName)} · ${row.projects.join(", ")}`,
              }))}
              emptyLabel="No submissions for this date."
              onSelect={onSelectEmployee}
              selectedName={selectedEmployee}
            />
            <AttendanceList
              title="Not submitted"
              icon={UserX2}
              tone="warning"
              rows={attendance.missing.map((row) => ({
                id: row.employeeId,
                name: row.employeeName,
                meta: `${teamTabLabel(row.team as import("@/types").TeamName)} · ${row.role}`,
              }))}
              emptyLabel="Everyone submitted for this date."
              onSelect={onSelectEmployee}
              selectedName={selectedEmployee}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AttendanceList({
  title,
  icon: Icon,
  tone,
  rows,
  emptyLabel,
  onSelect,
  selectedName,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warning";
  rows: Array<{ id: string; name: string; meta: string }>;
  emptyLabel: string;
  onSelect?: (employeeName: string) => void;
  selectedName?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
          )}
        />
        <p className="text-sm font-medium">{title}</p>
        <span className="text-xs text-muted-foreground">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelect?.(row.name)}
                className={cn(
                  "w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50",
                  selectedName === row.name && "bg-primary/10 ring-1 ring-primary/20",
                )}
              >
                <p className="text-sm font-medium text-foreground">{row.name}</p>
                <p className="truncate text-xs text-muted-foreground">{row.meta}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatAttendanceDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
