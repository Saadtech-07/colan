"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { InlinePageLoader } from "@/components/ui/inline-page-loader";
import { fetchPlatformAuditLogs } from "@/lib/platform/platform-client";

type AuditRow = {
  id: string;
  actorEmail: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  companyId?: string;
  createdAt: string;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = React.useState<AuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchPlatformAuditLogs()
      .then((data) => setLogs(data.logs as AuditRow[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load audit logs."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Audit Logs</h2>
        <p className="mt-1 text-sm text-muted-foreground">Platform-level actions performed by super admins.</p>
      </div>

      {loading ? (
        <InlinePageLoader title="Loading audit logs…" />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">{error}</div>
      ) : logs.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No audit entries yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="rounded-2xl">
              <CardContent className="py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{log.action}</p>
                  <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {log.actorName} ({log.actorEmail}) · {log.resourceType}
                  {log.resourceId ? ` · ${log.resourceId}` : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
