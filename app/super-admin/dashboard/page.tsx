"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, ShieldCheck, UserCog, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPlatformDashboardStats, type PlatformDashboardStats } from "@/lib/platform/platform-client";
import { InlinePageLoader } from "@/components/ui/inline-page-loader";

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = React.useState<PlatformDashboardStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchPlatformDashboardStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load dashboard."));
  }, []);

  if (!stats && !error) {
    return <InlinePageLoader title="Loading platform dashboard…" />;
  }

  if (error || !stats) {
    return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform overview across all tenant workspaces.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Companies" value={stats.totalCompanies} icon={Building2} />
        <StatCard title="Active Companies" value={stats.activeCompanies} icon={ShieldCheck} />
        <StatCard title="Inactive Companies" value={stats.inactiveCompanies} icon={Building2} />
        <StatCard title="Tenant Admins" value={stats.totalTenantAdmins} icon={UserCog} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recently Created Companies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No companies yet.</p>
            ) : (
              stats.recentCompanies.map((company) => (
                <Link
                  key={company.id}
                  href={`/super-admin/companies/${company.id}`}
                  className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.slug}</p>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{company.status}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recently Added Tenant Admins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentTenantAdmins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tenant admins yet.</p>
            ) : (
              stats.recentTenantAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {admin.companyName}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
