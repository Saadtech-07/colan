"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { canAccessChat } from "@/lib/chat-access";
import { useAppState } from "@/providers/app-state";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

export default function ChatPage() {
  const router = useRouter();
  const { access, sessionStatus } = useAppState();
  const canChat = !!access && canAccessChat(access.role);
  const ready = sessionStatus !== "loading" && (sessionStatus !== "authenticated" || !!access);

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
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <LoadingIndicator title="Loading messages" description="Opening chat…" />
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
