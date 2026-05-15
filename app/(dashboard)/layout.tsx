import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AppStateProvider } from "@/providers/app-state";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppStateProvider>
      <DashboardShell>{children}</DashboardShell>
    </AppStateProvider>
  );
}
