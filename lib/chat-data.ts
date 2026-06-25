import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { ensureChatConversationIndexes } from "@/lib/chat-indexes";
import { objectIdsEqual, readObjectIdHex, sortParticipantIdPair } from "@/lib/object-id";
import { isWorkspaceChatAdmin } from "@/lib/chat-access";
import { getRoleDefinition, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import {
  COLLECTIONS,
  appUserDocToPublic,
  conversationDocToDTO,
  employeeDocToDTO,
  ensureColanModelIndexes,
  messageDocToDTO,
  resolveConversationParticipants,
  type AppUserDocument,
  type ConversationDocument,
  type ConversationDTO,
  type EmployeeDocument,
  type MessageDocument,
  type MessageDTO,
} from "@/models";
import type {
  ChatConversationDetail,
  ChatConversationSummary,
  ChatParticipantProfile,
  ChatSearchUser,
} from "@/types/chat";

export type ChatActor = {
  id: string;
  email: string;
  name: string;
  appRole: string;
  team?: string;
  imageUrl: string;
  isAdmin: boolean;
};

export function getCounterpartyId(
  viewerId: string,
  participants: [string, string],
): string {
  if (objectIdsEqual(participants[0], viewerId)) return participants[1];
  if (objectIdsEqual(participants[1], viewerId)) return participants[0];
  return participants[0] === viewerId ? participants[1] : participants[0];
}

function viewerInConversation(viewerId: string, conversation: ConversationDTO): boolean {
  return (
    objectIdsEqual(conversation.participants[0], viewerId) ||
    objectIdsEqual(conversation.participants[1], viewerId)
  );
}

function participantLookup(userId: string): (string | ObjectId)[] {
  const hex = readObjectIdHex(userId);
  if (!hex) return [];
  return [hex, new ObjectId(hex)];
}

function conversationFilterForUser(userId: string) {
  const keys = participantLookup(userId);
  return {
    $or: [
      { "participants.0": { $in: keys } },
      { "participants.1": { $in: keys } },
    ],
  };
}

async function findDirectConversationDoc(
  userA: string,
  userB: string,
): Promise<ConversationDocument | null> {
  const db = await getDb();
  if (!db) return null;

  const [p0, p1] = sortParticipantIdPair(userA, userB);
  const keys0 = participantLookup(p0);
  const keys1 = participantLookup(p1);

  return db.collection<ConversationDocument>(COLLECTIONS.conversations).findOne({
    $or: [
      { "participants.0": keys0[0], "participants.1": keys1[0] },
      { "participants.0": keys0[1], "participants.1": keys1[1] },
      { "participants.0": keys0[0], "participants.1": keys1[1] },
      { "participants.0": keys0[1], "participants.1": keys1[0] },
    ],
  });
}

export async function getChatActorByEmail(email: string): Promise<ChatActor | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureColanModelIndexes(db);
  const doc = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).findOne({
    email: email.toLowerCase().trim(),
  });
  if (!doc) return null;
  const pub = appUserDocToPublic(doc);
  const profile = await resolveParticipantProfile(pub.id, pub.name, pub.imageUrl, pub.employeeId);
  return {
    id: pub.id,
    email: pub.email,
    name: profile.name,
    appRole: pub.appRole,
    team: pub.team,
    imageUrl: profile.imageUrl,
    isAdmin: isWorkspaceChatAdmin(pub.appRole),
  };
}

export async function getChatActorById(userId: string): Promise<ChatActor | null> {
  if (!ObjectId.isValid(userId)) return null;
  const db = await getDb();
  if (!db) return null;
  const doc = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).findOne({
    _id: new ObjectId(userId),
  });
  if (!doc) return null;
  const pub = appUserDocToPublic(doc);
  const profile = await resolveParticipantProfile(pub.id, pub.name, pub.imageUrl, pub.employeeId);
  return {
    id: pub.id,
    email: pub.email,
    name: profile.name,
    appRole: pub.appRole,
    team: pub.team,
    imageUrl: profile.imageUrl,
    isAdmin: isWorkspaceChatAdmin(pub.appRole),
  };
}

async function resolveParticipantProfile(
  userId: string,
  fallbackName: string,
  fallbackImage: string,
  employeeId: string,
): Promise<{ name: string; imageUrl: string }> {
  const db = await getDb();
  if (!db || !employeeId.trim()) {
    return { name: fallbackName, imageUrl: fallbackImage };
  }
  const employee = await db.collection<EmployeeDocument>(COLLECTIONS.employees).findOne({
    employeeId: employeeId.trim(),
  });
  if (!employee) {
    return { name: fallbackName, imageUrl: fallbackImage };
  }
  const dto = employeeDocToDTO(employee);
  return {
    name: dto.name || fallbackName,
    imageUrl: dto.imageUrl || fallbackImage,
  };
}

export async function getAnchorAdminUserId(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const doc = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).findOne(
    { appRole: "admin" },
    { sort: { createdAt: 1 } },
  );
  return doc ? doc._id.toHexString() : null;
}

async function roleLabelFor(appRole: string): Promise<string> {
  await ensureRoleRegistry();
  return getRoleDefinition(normalizeAppRole(appRole)).label;
}

async function enrichParticipant(
  userId: string,
  onlineUserIds: Set<string>,
): Promise<ChatParticipantProfile | null> {
  const actor = await getChatActorById(userId);
  if (!actor) return null;
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    imageUrl: actor.imageUrl,
    appRole: actor.appRole,
    roleLabel: await roleLabelFor(actor.appRole),
    team: actor.team,
    isOnline: onlineUserIds.has(actor.id),
  };
}

/** All app users the viewer can message (any role, except self). */
export async function searchChatRecipients(args: {
  viewerUserId: string;
  query?: string;
  onlineUserIds?: Set<string>;
  limit?: number;
}): Promise<ChatSearchUser[]> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(args.viewerUserId)) return [];

  const q = (args.query ?? "").trim().toLowerCase();
  const limit = args.limit ?? 24;
  const online = args.onlineUserIds ?? new Set<string>();

  const existingConversations = await db
    .collection<ConversationDocument>(COLLECTIONS.conversations)
    .find(conversationFilterForUser(args.viewerUserId), { projection: { participants: 1 } })
    .toArray();

  const conversationPartnerIds = new Set<string>();
  for (const conv of existingConversations) {
    const participants = resolveConversationParticipants(conv);
    if (!participants) continue;
    conversationPartnerIds.add(getCounterpartyId(args.viewerUserId, participants));
  }

  const users = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).find({}).toArray();
  const results: ChatSearchUser[] = [];

  for (const doc of users) {
    const pub = appUserDocToPublic(doc);
    if (pub.id === args.viewerUserId) continue;

    const profile = await resolveParticipantProfile(
      pub.id,
      pub.name,
      pub.imageUrl,
      pub.employeeId,
    );
    const roleLabel = await roleLabelFor(pub.appRole);
    const haystack = [profile.name, pub.email, pub.employeeId, pub.appRole, roleLabel, pub.team ?? ""]
      .join(" ")
      .toLowerCase();

    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      if (tokens.length && !tokens.every((token) => haystack.includes(token))) continue;
    }

    results.push({
      id: pub.id,
      name: profile.name,
      email: pub.email,
      imageUrl: profile.imageUrl,
      appRole: pub.appRole,
      roleLabel,
      team: pub.team,
      isOnline: online.has(pub.id),
      hasConversation: conversationPartnerIds.has(pub.id),
    });
  }

  results.sort((a, b) => {
    if (a.hasConversation !== b.hasConversation) return a.hasConversation ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

export async function getOrCreateDirectConversation(
  userA: string,
  userB: string,
): Promise<ConversationDTO | null> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(userA) || !ObjectId.isValid(userB)) return null;
  if (userA === userB) throw new Error("You cannot message yourself.");

  await ensureChatConversationIndexes(db);

  const [p0, p1] = sortParticipantIdPair(userA, userB);
  const col = db.collection<ConversationDocument>(COLLECTIONS.conversations);

  const existing = await findDirectConversationDoc(userA, userB);
  if (existing) {
    const repaired = await repairConversationParticipants(existing);
    return conversationDocToDTO(repaired);
  }

  const now = new Date();
  const doc: ConversationDocument = {
    _id: new ObjectId(),
    participants: [new ObjectId(p0), new ObjectId(p1)],
    lastMessage: "",
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await col.insertOne(doc);
  } catch (error) {
    const race = await findDirectConversationDoc(userA, userB);
    if (race) {
      const repaired = await repairConversationParticipants(race);
      return conversationDocToDTO(repaired);
    }

    const code = (error as { code?: number }).code;
    if (code === 11000) {
      await ensureChatConversationIndexes(db);
      try {
        await col.insertOne(doc);
        return conversationDocToDTO(doc);
      } catch (retryError) {
        const retryRace = await findDirectConversationDoc(userA, userB);
        if (retryRace) {
          const repaired = await repairConversationParticipants(retryRace);
          return conversationDocToDTO(repaired);
        }
        const msg = retryError instanceof Error ? retryError.message : "Duplicate key";
        throw new Error(`Could not create conversation: ${msg}`);
      }
    }

    const msg = error instanceof Error ? error.message : "Insert failed";
    throw new Error(`Could not create conversation: ${msg}`);
  }

  return conversationDocToDTO(doc);
}

export async function startConversationWithUser(
  viewerId: string,
  targetUserId: string,
  onlineUserIds: Set<string> = new Set(),
): Promise<ChatConversationSummary | null> {
  if (!ObjectId.isValid(targetUserId) || !ObjectId.isValid(viewerId)) {
    throw new Error("Invalid user.");
  }
  if (targetUserId === viewerId) {
    throw new Error("You cannot message yourself.");
  }

  const target = await getChatActorById(targetUserId);
  if (!target) throw new Error("User not found.");

  const conv = await getOrCreateDirectConversation(viewerId, targetUserId);
  if (!conv) return null;
  return getConversationDetail(conv.id, viewerId, onlineUserIds);
}

async function countUnreadForUser(
  conversationId: ObjectId,
  readerId: ObjectId,
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  return db.collection<MessageDocument>(COLLECTIONS.messages).countDocuments({
    conversationId,
    receiverId: readerId,
    isRead: false,
  });
}

export async function listUserConversations(
  viewerId: string,
  onlineUserIds: Set<string> = new Set(),
): Promise<ChatConversationSummary[]> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(viewerId)) return [];

  const docs = await db
    .collection<ConversationDocument>(COLLECTIONS.conversations)
    .find(conversationFilterForUser(viewerId))
    .sort({ lastMessageAt: -1 })
    .toArray();

  const viewerOid = new ObjectId(viewerId);
  const summaries: ChatConversationSummary[] = [];

  for (const doc of docs) {
    const participantIds = resolveConversationParticipants(doc);
    if (!participantIds) continue;
    const counterpartyId = getCounterpartyId(viewerId, participantIds);
    const participant = await enrichParticipant(counterpartyId, onlineUserIds);
    if (!participant) continue;
    const unreadCount = await countUnreadForUser(doc._id, viewerOid);
    summaries.push({
      id: readObjectIdHex(doc._id),
      employeeUserId: readObjectIdHex(doc.employeeUserId) || undefined,
      lastMessage: doc.lastMessage,
      lastMessageAt: doc.lastMessageAt.toISOString(),
      unreadCount,
      participant,
    });
  }

  return summaries;
}

export async function getConversationDetail(
  conversationId: string,
  viewerId: string,
  onlineUserIds: Set<string> = new Set(),
): Promise<ChatConversationDetail | null> {
  const conversation = await getConversationById(conversationId);
  if (!conversation || !ObjectId.isValid(viewerId)) return null;
  if (!viewerInConversation(viewerId, conversation)) return null;

  const counterpartyId = getCounterpartyId(viewerId, conversation.participants);
  const participant = await enrichParticipant(counterpartyId, onlineUserIds);
  if (!participant) return null;

  const db = await getDb();
  if (!db) return null;

  const unreadCount = await countUnreadForUser(
    new ObjectId(conversation.id),
    new ObjectId(viewerId),
  );

  return {
    id: conversation.id,
    employeeUserId: conversation.employeeUserId,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount,
    participant,
    participants: conversation.participants,
  };
}

async function repairConversationParticipants(
  doc: ConversationDocument,
): Promise<ConversationDocument> {
  let participants = resolveConversationParticipants(doc);
  if (!participants) {
    const employee = readObjectIdHex(doc.employeeUserId);
    const adminId = employee ? await getAnchorAdminUserId() : null;
    if (employee && adminId) {
      participants = sortParticipantIdPair(employee, adminId);
    }
  }
  if (!participants) return doc;

  const [p0, p1] = participants;
  const raw = doc.participants;
  const stored0 = Array.isArray(raw) ? readObjectIdHex(raw[0]) : "";
  const stored1 = Array.isArray(raw) ? readObjectIdHex(raw[1]) : "";
  if (stored0 === p0 && stored1 === p1) return doc;

  const db = await getDb();
  if (!db) return doc;

  const repaired: [ObjectId, ObjectId] = [new ObjectId(p0), new ObjectId(p1)];
  await db.collection<ConversationDocument>(COLLECTIONS.conversations).updateOne(
    { _id: doc._id },
    { $set: { participants: repaired, updatedAt: new Date() } },
  );

  return { ...doc, participants: repaired };
}

export async function getConversationById(
  conversationId: string,
): Promise<ConversationDTO | null> {
  if (!ObjectId.isValid(conversationId)) return null;
  const db = await getDb();
  if (!db) return null;
  const doc = await db
    .collection<ConversationDocument>(COLLECTIONS.conversations)
    .findOne({ _id: new ObjectId(conversationId) });
  if (!doc) return null;
  const repaired = await repairConversationParticipants(doc);
  if (!resolveConversationParticipants(repaired)) return null;
  return conversationDocToDTO(repaired);
}

export function assertConversationAccess(
  actor: ChatActor,
  conversation: ConversationDTO,
): string | null {
  if (viewerInConversation(actor.id, conversation)) return null;
  return "You do not have access to this conversation.";
}

export async function listMessages(conversationId: string): Promise<MessageDTO[]> {
  if (!ObjectId.isValid(conversationId)) return [];
  const db = await getDb();
  if (!db) return [];

  const docs = await db
    .collection<MessageDocument>(COLLECTIONS.messages)
    .find({ conversationId: new ObjectId(conversationId) })
    .sort({ createdAt: 1 })
    .toArray();

  return docs.map(messageDocToDTO);
}

export type SendMessageResult = {
  message: MessageDTO;
  conversation: ConversationDTO;
};

export async function sendChatMessage(args: {
  conversationId: string;
  senderId: string;
  text: string;
}): Promise<SendMessageResult> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");
  if (!ObjectId.isValid(args.conversationId) || !ObjectId.isValid(args.senderId)) {
    throw new Error("Invalid conversation or sender.");
  }

  const trimmed = args.text.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");

  const conversation = await getConversationById(args.conversationId);
  if (!conversation) throw new Error("Conversation not found.");

  const [p0, p1] = conversation.participants;
  const senderOid = new ObjectId(args.senderId);
  const isParticipant =
    new ObjectId(p0).equals(senderOid) || new ObjectId(p1).equals(senderOid);
  if (!isParticipant) {
    throw new Error("You cannot send messages in this conversation.");
  }

  const conversationOid = new ObjectId(args.conversationId);
  const receiverId = new ObjectId(getCounterpartyId(args.senderId, [p0, p1]));

  const now = new Date();
  const messageDoc: MessageDocument = {
    _id: new ObjectId(),
    conversationId: conversationOid,
    senderId: senderOid,
    receiverId,
    text: trimmed,
    isRead: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<MessageDocument>(COLLECTIONS.messages).insertOne(messageDoc);
  await db.collection<ConversationDocument>(COLLECTIONS.conversations).updateOne(
    { _id: conversationOid },
    {
      $set: {
        lastMessage: trimmed,
        lastMessageAt: now,
        updatedAt: now,
      },
    },
  );

  const sender = await getChatActorById(args.senderId);
  const { notifyMessageReceived } = await import("@/lib/notifications-data");
  await notifyMessageReceived({
    conversationId: args.conversationId,
    senderUserId: args.senderId,
    senderName: sender?.name ?? "Someone",
    recipientUserId: receiverId.toHexString(),
    text: trimmed,
  });

  return {
    message: messageDocToDTO(messageDoc),
    conversation: {
      ...conversation,
      lastMessage: trimmed,
      lastMessageAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
}

export async function markConversationRead(args: {
  conversationId: string;
  readerId: string;
}): Promise<number> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(args.conversationId) || !ObjectId.isValid(args.readerId)) {
    return 0;
  }

  const result = await db.collection<MessageDocument>(COLLECTIONS.messages).updateMany(
    {
      conversationId: new ObjectId(args.conversationId),
      receiverId: new ObjectId(args.readerId),
      isRead: false,
    },
    { $set: { isRead: true, updatedAt: new Date() } },
  );

  return result.modifiedCount;
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  if (!ObjectId.isValid(userId)) return 0;
  const db = await getDb();
  if (!db) return 0;

  return db.collection<MessageDocument>(COLLECTIONS.messages).countDocuments({
    receiverId: new ObjectId(userId),
    isRead: false,
  });
}
