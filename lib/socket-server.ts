import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { getToken } from "next-auth/jwt";
import {
  getChatActorByEmail,
  getConversationById,
  markConversationRead,
  sendChatMessage,
  assertConversationAccess,
} from "@/lib/chat-data";
import {
  getOnlineUserIds,
  isUserOnline,
  registerChatSocket,
  unregisterChatSocket,
} from "@/lib/chat-online";
import { canAccessChat, canSendChat } from "@/lib/chat-access";
import { ensureRoleRegistry } from "@/lib/role-registry.server";

type SocketUser = {
  id: string;
  email: string;
  name: string;
  appRole: string;
  isAdmin: boolean;
};

let io: Server | null = null;

function broadcastUserStatus(userId: string, isOnline: boolean) {
  io?.emit("user-status", { userId, isOnline });
}

export function getSocketServer(): Server | null {
  return io;
}

export function initSocketServer(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    path: "/api/socket/io",
    cors: {
      origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = await getToken({
        req: socket.request as Parameters<typeof getToken>[0]["req"],
        secret:
          process.env.AUTH_SECRET ??
          "dev-colan-auth-secret-minimum-32-characters-long",
      });
      const email = typeof token?.email === "string" ? token.email : "";
      if (!email) {
        return next(new Error("Unauthorized"));
      }
      await ensureRoleRegistry();
      const actor = await getChatActorByEmail(email);
      if (!actor || !canAccessChat(actor.appRole)) {
        return next(new Error("Forbidden"));
      }
      const user: SocketUser = {
        id: actor.id,
        email: actor.email,
        name: actor.name,
        appRole: actor.appRole,
        isAdmin: actor.isAdmin,
      };
      socket.data.user = user;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;
    registerChatSocket(user.id, socket.id);
    broadcastUserStatus(user.id, true);

    socket.emit("register-user", {
      userId: user.id,
      isOnline: true,
      onlineUserIds: [...getOnlineUserIds()],
    });

    socket.on("send-message", async (payload: { conversationId?: string; text?: string }, ack) => {
      try {
        const chatData = await import("@/lib/chat-data");
        const { emitChatMessageSent } = await import("@/lib/chat-realtime");

        if (!canSendChat(user.appRole)) {
          throw new Error("You do not have permission to send messages.");
        }
        const conversationId = payload?.conversationId?.trim() ?? "";
        const text = payload?.text?.trim() ?? "";
        if (!conversationId || !text) throw new Error("Invalid message payload.");

        const conversation = await chatData.getConversationById(conversationId);
        if (!conversation) throw new Error("Conversation not found.");

        const actor = await chatData.getChatActorByEmail(user.email);
        if (!actor) throw new Error("Account not found.");

        const denied = chatData.assertConversationAccess(actor, conversation);
        if (denied) throw new Error(denied);

        const result = await chatData.sendChatMessage({
          conversationId,
          senderId: actor.id,
          text,
        });

        emitChatMessageSent(result);

        if (typeof ack === "function") {
          ack({ ok: true, message: result.message, conversation: result.conversation });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to send message";
        if (typeof ack === "function") ack({ ok: false, error: message });
      }
    });

    socket.on("mark-as-read", async (payload: { conversationId?: string }, ack) => {
      try {
        const conversationId = payload?.conversationId?.trim() ?? "";
        if (!conversationId) throw new Error("conversationId is required.");

        const conversation = await getConversationById(conversationId);
        if (!conversation) throw new Error("Conversation not found.");

        const actor = await getChatActorByEmail(user.email);
        if (!actor) throw new Error("Account not found.");

        const denied = assertConversationAccess(actor, conversation);
        if (denied) throw new Error(denied);

        const modified = await markConversationRead({
          conversationId,
          readerId: user.id,
        });

        io?.emit("messages-read", {
          conversationId,
          readerId: user.id,
          modified,
        });

        if (typeof ack === "function") ack({ ok: true, modified });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to mark as read";
        if (typeof ack === "function") ack({ ok: false, error: message });
      }
    });

    socket.on("disconnect", () => {
      unregisterChatSocket(user.id, socket.id);
      if (!isUserOnline(user.id)) {
        broadcastUserStatus(user.id, false);
      }
    });
  });

  return io;
}
