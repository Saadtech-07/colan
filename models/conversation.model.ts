import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";
import { readObjectIdHex, sortParticipantIdPair } from "@/lib/object-id";

export const CONVERSATION_COLLECTION = COLLECTIONS.conversations;

/** Direct message thread between two app users (sorted participant pair). */
export type ConversationDocument = {
  _id: ObjectId;
  /** Sorted [lowerUserId, higherUserId] — may be partial in legacy rows */
  participants?: unknown;
  /** @deprecated Legacy employee↔admin inbox; omitted on new peer threads */
  employeeUserId?: ObjectId;
  lastMessage: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ConversationDTO = {
  id: string;
  participants: [string, string];
  /** @deprecated Present on legacy admin inbox threads only */
  employeeUserId?: string;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
};

export function resolveConversationParticipants(
  doc: Pick<ConversationDocument, "participants" | "employeeUserId">,
): [string, string] | null {
  const ids: string[] = [];
  const raw = doc.participants;

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const hex = readObjectIdHex(entry);
      if (hex) ids.push(hex);
    }
  }

  const unique = [...new Set(ids)];
  if (unique.length >= 2) {
    const sorted = unique.sort();
    return [sorted[0]!, sorted[1]!];
  }

  const employee = readObjectIdHex(doc.employeeUserId);
  if (employee && unique.length === 1) {
    return sortParticipantIdPair(employee, unique[0]!);
  }

  return null;
}

export function conversationDocToDTO(doc: ConversationDocument): ConversationDTO {
  const participants = resolveConversationParticipants(doc);
  if (!participants) {
    throw new Error("Conversation is missing participants.");
  }

  return {
    id: readObjectIdHex(doc._id),
    participants,
    employeeUserId: readObjectIdHex(doc.employeeUserId) || undefined,
    lastMessage: doc.lastMessage,
    lastMessageAt: doc.lastMessageAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
