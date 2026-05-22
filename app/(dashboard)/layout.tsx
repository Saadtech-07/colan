import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AppStateProvider } from "@/providers/app-state";
import { GlobalLoadingProvider } from "@/providers/global-loading";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppStateProvider>
      <GlobalLoadingProvider>
        <DashboardShell>{children}</DashboardShell>
      </GlobalLoadingProvider>
    </AppStateProvider>
  );
}
