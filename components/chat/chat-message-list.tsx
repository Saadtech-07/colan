"use client";

import * as React from "react";
import { Check, CheckCheck } from "lucide-react";
import { formatChatTime } from "@/lib/chat-client";
import { cn } from "@/lib/utils";
import type { MessageDTO } from "@/models";

type Props = {
  messages: MessageDTO[];
  currentUserId: string;
  loading?: boolean;
};

export function ChatMessageList({ messages, currentUserId, loading }: Props) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading messages…
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No messages yet. Say hello to start the conversation.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((message) => {
        const isMine = message.senderId === currentUserId;
        return (
          <div
            key={message.id}
            className={cn("flex", isMine ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[min(85%,28rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                isMine
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md border border-border/60 bg-background",
              )}
            >
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
              <div
                className={cn(
                  "mt-1 flex items-center justify-end gap-1 text-[10px]",
                  isMine ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                <span>{formatChatTime(message.createdAt)}</span>
                {isMine ? (
                  message.isRead ? (
                    <CheckCheck className="h-3 w-3" aria-label="Read" />
                  ) : (
                    <Check className="h-3 w-3" aria-label="Sent" />
                  )
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
