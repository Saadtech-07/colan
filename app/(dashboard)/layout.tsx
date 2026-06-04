import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AppStateProvider } from "@/providers/app-state";
import { ChatProvider } from "@/providers/chat-provider";
import { GlobalLoadingProvider } from "@/providers/global-loading";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppStateProvider>
      <ChatProvider>
        <GlobalLoadingProvider>
          <DashboardShell>{children}</DashboardShell>
        </GlobalLoadingProvider>
      </ChatProvider>
    </AppStateProvider>
  );
}
