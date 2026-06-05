import { ObjectId, type Db } from "mongodb";
import { readObjectIdHex } from "@/lib/object-id";
import { COLLECTIONS } from "@/models/collections";
import {
  resolveConversationParticipants,
  type ConversationDocument,
} from "@/models/conversation.model";

/** Drop legacy employeeUserId unique index and ensure peer-to-peer participant indexes. */
export async function ensureChatConversationIndexes(db: Db): Promise<void> {
  const conversations = db.collection<ConversationDocument>(COLLECTIONS.conversations);

  const convDocs = await conversations.find({}).toArray();
  for (const doc of convDocs) {
    const participants = resolveConversationParticipants(doc);
    if (!participants) continue;
    const [p0, p1] = participants;
    const raw = doc.participants;
    const stored0 = Array.isArray(raw) ? readObjectIdHex(raw[0]) : "";
    const stored1 = Array.isArray(raw) ? readObjectIdHex(raw[1]) : "";
    if (stored0 === p0 && stored1 === p1) continue;
    await conversations.updateOne(
      { _id: doc._id },
      { $set: { participants: [new ObjectId(p0), new ObjectId(p1)], updatedAt: new Date() } },
    );
  }

  const indexes = await conversations.indexes();
  const indexNames = new Set(indexes.map((idx) => idx.name));
  const hasParticipantPairIndex = indexes.some(
    (idx) => idx.key?.["participants.0"] === 1 && idx.key?.["participants.1"] === 1,
  );
  const hasParticipantListIndex = indexes.some(
    (idx) => idx.key?.participants === 1 && idx.key?.lastMessageAt === -1,
  );

  if (indexNames.has("employeeUserId_1")) {
    await conversations.dropIndex("employeeUserId_1");
  }

  if (!hasParticipantPairIndex) {
    await conversations.createIndex(
      { "participants.0": 1, "participants.1": 1 },
      { unique: true },
    );
  }

  if (!hasParticipantListIndex) {
    await conversations.createIndex({ participants: 1, lastMessageAt: -1 });
  }

  if (!indexNames.has("lastMessageAt_-1")) {
    await conversations.createIndex({ lastMessageAt: -1 });
  }
}
