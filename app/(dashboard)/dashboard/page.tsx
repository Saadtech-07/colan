"use client";

import * as React from "react";
import {
  DashboardAlert,
  DashboardEmployeeDistribution,
  DashboardKpiGrid,
  DashboardProjectOverview,
  DashboardRecentActivity,
  DashboardSkeleton,
  DashboardUpcomingDeadlines,
  DashboardWelcomeHeader,
} from "@/components/dashboard/dashboard-panels";
import { buildDashboardOverview } from "@/lib/dashboard-overview";
import { useAppState } from "@/providers/app-state";

export default function DashboardPage() {
  const {
    projects,
    access,
    user,
    employees,
    dataError,
    dataSummary,
    teamNames,
    dataLoading,
    refreshData,
  } = useAppState();

  const [refreshing, setRefreshing] = React.useState(false);
  const today = React.useMemo(() => new Date(), []);

  const overview = React.useMemo(
    () =>
      buildDashboardOverview({
        user,
        access,
        projects,
        employees,
        teamNames,
        today,
      }),
    [access, employees, projects, teamNames, today, user],
  );

  const isInitialLoading =
    dataLoading &&
    projects.length === 0 &&
    employees.length === 0 &&
    teamNames.length === 0;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      {dataSummary?.backend === "memory" ? (
        <DashboardAlert
          tone="warning"
          title="In-memory data"
          description={`${dataSummary.reason} Lists reset when the server restarts.`}
        />
      ) : null}
      {dataSummary?.backend === "error" ? (
        <DashboardAlert
          tone="danger"
          title="MongoDB connection failed"
          description={dataSummary.message}
        />
      ) : null}
      {dataError ? (
        <DashboardAlert
          tone="danger"
          title="Workspace data error"
          description={
            <>
              {dataError}{" "}
              <span className="opacity-80">
                Check API routes and optional <code className="text-xs">MONGODB_URI</code>.
              </span>
            </>
          }
        />
      ) : null}

      {isInitialLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <DashboardWelcomeHeader
            name={overview.greetingName}
            scopeLabel={overview.scopeLabel}
            onRefresh={() => void handleRefresh()}
            refreshing={refreshing || dataLoading}
          />

          <DashboardKpiGrid kpis={overview.kpis} />

          <section className="grid gap-6 lg:grid-cols-2">
            <DashboardProjectOverview
              stats={overview.projectStats}
              total={overview.totalProjects}
            />
            <DashboardEmployeeDistribution
              data={overview.employeeDistribution}
              total={overview.totalEmployeesInDistribution}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <DashboardRecentActivity items={overview.recentActivity} today={today} />
            <DashboardUpcomingDeadlines items={overview.upcomingDeadlines} />
          </section>
        </>
      )}
    </div>
  );
}
