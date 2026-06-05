"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { canAccessChat } from "@/lib/chat-access";
import { useAppState } from "@/providers/app-state";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

export default function ChatPage() {
  const router = useRouter();
  const { access, sessionStatus, dataLoading } = useAppState();
  const canChat = !!access && canAccessChat(access.role);
  const ready = sessionStatus !== "loading" && !(sessionStatus === "authenticated" && dataLoading);

  React.useEffect(() => {
    if (!ready) return;
    if (!canChat) {
      router.replace("/dashboard");
    }
  }, [canChat, ready, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingIndicator title="Loading messages" description="Checking your access…" />
      </div>
    );
  }

  if (!canChat) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search any app user (admin, manager, employee, project manager, …) and start or continue a
          conversation.
        </p>
      </div>
      <ChatWorkspace />
    </div>
  );
}
